# Phase 1 — Batch 1A + 1B (Revised: Plaid deferred)

**Status:** Ready to execute
**Scope:** RBAC middleware + input validation (no Plaid work)
**Parallel batches:** 1A and 1B run simultaneously
**Total effort:** 3.5 hours
**Total tokens:** ~5.2k
**Validation time:** 1 hour

---

## Batch 1A: Auth Infrastructure (2 hours)

### 1A-1: Create user_roles table in Supabase

**SQL (run in Supabase SQL editor):**
```sql
-- Create user_roles table
CREATE TABLE user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
```

**Set Joshua as admin:**
```sql
-- Replace UUID with Joshua's actual auth.users.id
INSERT INTO user_roles (user_id, role)
VALUES ('<JOSHUA_UUID>', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

---

### 1A-2: Create requireRole() middleware in auth.js

**File:** `api/middleware/auth.js` (add to existing file)

```javascript
/**
 * requireRole(allowedRoles)
 * Middleware that checks user's role against allowed list.
 * Short-circuits with 403 if role doesn't match.
 */
function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        try {
            const { data: roleRecord, error } = await req.sb
                .from("user_roles")
                .select("role")
                .eq("user_id", req.user.id)
                .single();

            if (error || !roleRecord) {
                console.warn(`[AUTH] User ${req.user.id} has no role record`);
                return res.status(403).json({ error: "Access Denied" });
            }

            if (!allowedRoles.includes(roleRecord.role)) {
                console.warn(`[AUTH] User ${req.user.id} (${roleRecord.role}) denied access to admin route`);
                return res.status(403).json({ error: "Admin access required" });
            }

            req.userRole = roleRecord.role;
            next();
        } catch (err) {
            console.error("[AUTH] Role check failed:", err.message);
            res.status(500).json({ error: "Role verification failed" });
        }
    };
}

module.exports = { requireRole };
```

---

### 1A-3: Update admin.js — Replace 10 email checks with requireRole('admin')

**Files affected:** `api/routes/admin.js`
**Lines to modify:** 20, 127, 287, 322, 368, 423, 444, 483, 502, 529

**Header change:**
```javascript
// OLD
const { sendInviteEmail, sendDailyReportEmail } = require("../utils/mailer");
const router = express.Router();

// NEW
const { queueInviteEmail, queueDailyReportEmail } = require("../utils/emailQueue");
const { requireRole } = require("../middleware/auth");
const router = express.Router();
```

**All 10 occurrences — same pattern:**

**OLD:**
```javascript
if (req.user?.email?.toLowerCase() !== 'joshua.deuermeyer@gmail.com') {
    return res.status(403).json({ error: "Denied" });
}
```

**NEW:**
```javascript
// Middleware handles auth; no inline check needed
```

**Instead, add middleware to route:**

```javascript
// Example: GET /admin/subscriptions
router.get("/subscriptions", requireRole('admin'), async (req, res) => {
    try {
        const { supabase: serviceClient } = require("../db");
        if (!serviceClient) throw new Error("Service client required for SaaS dashboard");
        // ... rest of handler
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
```

**Routes to update (10 total):**
1. Line 20: `/daily-report` GET — add `requireRole('admin'),` after route definition
2. Line 127: `/check-status` GET — add middleware
3. Line 287: `/subscriptions` GET — add middleware
4. Line 322: `/subscriptions/:userId` PATCH — add middleware
5. Line 368: `/weekly-report` GET — add middleware
6. Line 423: `/beta-codes` GET — add middleware
7. Line 444: `/beta-codes` POST — add middleware
8. Line 483: `/beta-codes/:code` PATCH — add middleware
9. Line 502: `/beta-codes/:code/resend` POST — add middleware
10. Line 529: `/beta-codes/:code` DELETE — add middleware

**Effort:** 1.5 hours (systematic replacement, 10 locations)

---

## Batch 1B: Input Validation (1.5 hours, runs in parallel with 1A)

### 1B-1: receipts.js — File type whitelist validation

**File:** `api/routes/receipts.js`

**Install dependency:**
```bash
npm install file-type
```

**Add validation function (before route handlers):**

```javascript
const fileType = require('file-type');

/**
 * validateFileType(buffer, filename)
 * Validates file using MIME type + magic bytes.
 * Only allows: image/jpeg, image/png, application/pdf
 */
async function validateFileType(buffer, filename) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

    try {
        const type = await fileType.fromBuffer(buffer);

        if (!type) {
            return { valid: false, error: 'File type unrecognized' };
        }

        if (!ALLOWED_TYPES.includes(type.mime)) {
            return {
                valid: false,
                error: `File type ${type.mime} not allowed. Supported: JPEG, PNG, PDF`
            };
        }

        // Double-check extension matches (defense in depth)
        const ext = filename.split('.').pop()?.toLowerCase();
        const validExts = ['jpg', 'jpeg', 'png', 'pdf'];
        if (!validExts.includes(ext)) {
            return { valid: false, error: 'File extension mismatch' };
        }

        return { valid: true };
    } catch (err) {
        console.error('[RECEIPTS] File type validation error:', err.message);
        return { valid: false, error: 'File validation failed' };
    }
}
```

**Update upload endpoint (lines 67-88):**

```javascript
// OLD
router.post("/upload", multer.memoryStorage(), async (req, res) => {
    try {
        const file = req.files?.receipt?.[0];
        if (!file) return res.status(400).json({ error: "No file provided" });

        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        // ... rest

// NEW
router.post("/upload", multer.memoryStorage(), async (req, res) => {
    try {
        const file = req.files?.receipt?.[0];
        if (!file) return res.status(400).json({ error: "No file provided" });

        // Validate file type BEFORE processing
        const validation = await validateFileType(file.data, file.originalname);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        // ... rest
```

**Effort:** 45 minutes

---

### 1B-2: invoices.js — Add pagination to lists

**File:** `api/routes/invoices.js`

**Update clients list (lines 37-45):**

```javascript
// OLD
router.get("/clients", async (req, res) => {
    try {
        const { data, error } = await req.sb.from("clients").select("*").order("name");
        if (error) throw error;
        res.json(data);

// NEW
router.get("/clients", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 500); // max 500
        const offset = parseInt(req.query.offset) || 0;

        // Get total count
        const { count: totalCount } = await req.sb
            .from("clients")
            .select("*", { count: 'exact', head: true });

        // Get paginated data
        const { data, error } = await req.sb
            .from("clients")
            .select("*")
            .order("name")
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            data,
            pagination: {
                total: totalCount || 0,
                offset,
                limit,
                hasMore: offset + limit < (totalCount || 0)
            }
        });
```

**Update invoices list (lines 60-71):**

```javascript
// OLD
router.get("/", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from("invoices")
            .select("*, clients(name, email), invoice_items(*)")
            .order("issue_date", { ascending: false });
        if (error) throw error;
        res.json(data);

// NEW
router.get("/", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);
        const offset = parseInt(req.query.offset) || 0;

        // Get total count
        const { count: totalCount } = await req.sb
            .from("invoices")
            .select("*", { count: 'exact', head: true });

        // Get paginated data
        const { data, error } = await req.sb
            .from("invoices")
            .select("*, clients(name, email), invoice_items(*)")
            .order("issue_date", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            data,
            pagination: {
                total: totalCount || 0,
                offset,
                limit,
                hasMore: offset + limit < (totalCount || 0)
            }
        });
```

**Effort:** 1 hour

---

## Execution Plan

### Timeline (run 1A and 1B in parallel)

```
09:00-10:00 → Run Supabase SQL + insert Joshua as admin (30 min)
             + Start 1B-1 (file validation) in parallel (15 min setup)

10:00-11:00 → Add requireRole() middleware to auth.js (30 min)
             + Complete 1B-1 integration (30 min)

11:00-12:00 → Replace 10 email checks in admin.js (1 hour)
             + Update 1B-2 pagination (1 hour)

12:00-13:00 → Validation + testing (1 hour)
```

---

## Validation Checklist (1 hour)

### Test 1A: RBAC enforcement
```bash
# 1. Try to access /admin/beta-codes WITHOUT auth
curl http://localhost:3000/admin/beta-codes
# Expected: 401 Unauthorized

# 2. Try to access WITH auth but as non-admin user
curl -H "Authorization: Bearer <USER_TOKEN>" http://localhost:3000/admin/beta-codes
# Expected: 403 Access Denied

# 3. Access AS admin (Joshua)
curl -H "Authorization: Bearer <JOSHUA_TOKEN>" http://localhost:3000/admin/beta-codes
# Expected: 200 OK + beta codes list
```

### Test 1B-1: File type validation
```bash
# 1. Try to upload non-whitelisted file (e.g., .exe, .zip)
curl -F "receipt=@malware.exe" http://localhost:3000/invoices/receipts/upload
# Expected: 400 "File type application/x-exe not allowed"

# 2. Upload valid PDF
curl -F "receipt=@invoice.pdf" http://localhost:3000/invoices/receipts/upload
# Expected: 200 OK + file stored

# 3. Upload valid JPEG
curl -F "receipt=@photo.jpg" http://localhost:3000/invoices/receipts/upload
# Expected: 200 OK + file stored
```

### Test 1B-2: Pagination
```bash
# 1. Request clients with pagination
curl http://localhost:3000/invoices/clients?offset=0&limit=10
# Expected: { data: [...], pagination: { total: X, offset: 0, limit: 10, hasMore: true } }

# 2. Request second page
curl http://localhost:3000/invoices/clients?offset=10&limit=10
# Expected: { data: [...], pagination: { total: X, offset: 10, limit: 10, hasMore: true|false } }

# 3. Request with no limit (defaults to 50)
curl http://localhost:3000/invoices/clients
# Expected: { data: [...], pagination: { total: X, offset: 0, limit: 50, ... } }
```

### Test email queueing still works
```bash
# 1. Send test invoice
curl -X POST http://localhost:3000/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{ "client_id": 1, "invoice_number": "INV-001", ... }'
# Expected: 200 OK (email queued, not awaited)

# 2. Check Bull queue is processing
curl http://localhost:3000/admin/check-status
# Expected: 200 OK + diagnostics (no email send delay)
```

---

## Rollback Plan

If validation fails:

1. **RBAC issues** → Drop the middleware lines from routes, revert to inline email checks (10-min revert)
2. **File validation fails** → Remove validateFileType() call, allow all files (5-min revert)
3. **Pagination metadata wrong** → Remove pagination object from response, return just `data` array (5-min revert)

All changes are additive/non-destructive; rollback is straightforward.

---

## Next: Batch 1C (Deferred: Plaid work — resume in 2+ months)

When Plaid is ready to integrate:
- Batch 1C: Parallelize bank account syncs (Promise.all)
- Batch 2B-3: Batch Plaid sync modified/removed transactions

These stay in the roadmap but are **NOT critical path** for now.

---

## Start Now

Ready to begin?

1. **Deploy 1A first** (RBAC table + middleware)
2. **Deploy 1B in parallel** (file validation + pagination)
3. **Run validation checklist** after both complete
4. **Ship Phase 1** once all 4 tests pass

Files to touch:
- `api/middleware/auth.js` (new `requireRole` function)
- `api/routes/admin.js` (add middleware, remove 10 email checks)
- `api/routes/receipts.js` (add `validateFileType` function + call it)
- `api/routes/invoices.js` (add pagination to 2 GET routes)

**Estimated completion:** 3.5 hours + 1 hour validation = **4.5 hours today**

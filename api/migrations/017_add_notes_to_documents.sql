-- Adds a free-text notes column to user_documents so a document can carry
-- context (e.g. "receipt for the RF 24-70mm, warranty runs through 2027")
-- beyond just its filename and doc_type.
ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS notes text;

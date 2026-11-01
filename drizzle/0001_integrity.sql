-- Integrity rules that must hold even if application code is wrong. See docs/ARCHITECTURE.md.

CREATE OR REPLACE FUNCTION ukuphila_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % é só de acrescentar: as correcções são novos registos.', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'journal_entries', 'postings', 'entry_reviews', 'audit_events', 'access_log', 'kyc_events', 'kyc_attestations',
    'document_events', 'xitique_events', 'credit_decisions', 'credit_repayments', 'sync_ops', 'risk_case_notes'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ukuphila_append_only()',
      t || '_append_only', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION ukuphila_append_only()',
      t || '_no_truncate', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Double entry: at commit, every journal entry balances to zero and has at least two postings.
CREATE OR REPLACE FUNCTION ukuphila_entry_balances() RETURNS trigger AS $$
DECLARE total bigint; lines integer;
BEGIN
  SELECT coalesce(sum(amount_cents), 0), count(*) INTO total, lines FROM postings WHERE entry_id = NEW.entry_id;
  IF total <> 0 OR lines < 2 THEN
    RAISE EXCEPTION 'Lançamento % não balanceado (soma %, % linhas).', NEW.entry_id, total, lines
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER postings_balanced
  AFTER INSERT ON postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ukuphila_entry_balances();
--> statement-breakpoint

-- Hosted Postgres exposes tables through a REST layer. The app connects as owner (RLS bypassed), so enabling RLS with
-- no policies denies that surface by default.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

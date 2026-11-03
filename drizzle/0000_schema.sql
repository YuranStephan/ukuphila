CREATE SCHEMA IF NOT EXISTS "ukuphila";
--> statement-breakpoint
CREATE TABLE "ukuphila"."access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" text NOT NULL,
	"purpose" text NOT NULL,
	"resource" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."agent_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"subject_user_id" uuid,
	"is_example_rate" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"market_id" uuid NOT NULL,
	"kiosk_name" text NOT NULL,
	"kiosk_hours" text,
	"status" text DEFAULT 'em_formacao' NOT NULL,
	"trained_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "agents_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."ai_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"channel" text NOT NULL,
	"input" text NOT NULL,
	"intent" text NOT NULL,
	"confidence" double precision NOT NULL,
	"engine" text NOT NULL,
	"response" text NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"sources" jsonb,
	"guardrails" jsonb,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."audit_events" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text,
	"target_user_id" uuid,
	"data" jsonb,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"agent_id" uuid,
	"market_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stall" text,
	"activity" text NOT NULL,
	"category" text NOT NULL,
	"alt_contact" text,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"policy_version" text NOT NULL,
	"status" text DEFAULT 'concedido' NOT NULL,
	"channel" text NOT NULL,
	"captured_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."credit_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"requested_cents" bigint NOT NULL,
	"items" jsonb NOT NULL,
	"trust_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'submetido' NOT NULL,
	"offered_cents" bigint,
	"offered_term_days" integer,
	"offered_instalments" integer,
	"offered_fee_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_applications_code_unique" UNIQUE("code"),
	CONSTRAINT "credit_requested_ck" CHECK ("ukuphila"."credit_applications"."requested_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."credit_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"principal_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"term_days" integer NOT NULL,
	"status" text DEFAULT 'aguarda_entrega' NOT NULL,
	"terms_snapshot" jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"accepted_channel" text NOT NULL,
	"delivery_code" text NOT NULL,
	"delivered_at" timestamp with time zone,
	"delivery_confirmed_by" uuid,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_contracts_code_unique" UNIQUE("code"),
	CONSTRAINT "credit_contracts_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."credit_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"outcome" text NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"note" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."credit_instalments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'por_pagar' NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "credit_paid_ck" CHECK ("ukuphila"."credit_instalments"."paid_cents" >= 0 and "ukuphila"."credit_instalments"."paid_cents" <= "ukuphila"."credit_instalments"."amount_cents")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."credit_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"params" jsonb NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_policies_version_unique" UNIQUE("version"),
	CONSTRAINT "credit_policy_four_eyes_ck" CHECK ("ukuphila"."credit_policies"."approved_by" is null or "ukuphila"."credit_policies"."approved_by" <> "ukuphila"."credit_policies"."created_by")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."credit_repayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"method" text NOT NULL,
	"reference" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"entry_id" uuid,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_repayments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."device_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"device_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"status" text DEFAULT 'activo' NOT NULL,
	"instalment_cents" bigint NOT NULL,
	"instalments" integer NOT NULL,
	"frequency" text DEFAULT 'semanal' NOT NULL,
	"is_example_terms" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_leases_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."device_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price_cents" bigint NOT NULL,
	"specs" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"model_id" uuid,
	"label" text NOT NULL,
	"serial" text,
	"public_key" text,
	"status" text DEFAULT 'activo' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_seq" bigint DEFAULT 0 NOT NULL,
	"last_hash" text,
	"wipe_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."document_blobs" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"ciphertext" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."document_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"number_masked" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"storage_key" text,
	"mime" text,
	"size_bytes" integer,
	"sha256" text,
	"iv" text,
	"auth_tag" text,
	"key_id" text,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"rejection_note" text,
	"expiry_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_rejected_reason_ck" CHECK ("ukuphila"."documents"."status" <> 'rejeitado' or "ukuphila"."documents"."rejection_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."entry_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"note" text,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'media' NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"subject_user_id" uuid,
	"opened_by" uuid,
	"opened_via" text DEFAULT 'agente' NOT NULL,
	"assigned_to" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "incidents_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"op_id" uuid,
	"amount_cents" bigint NOT NULL,
	"category" text,
	"memo" text,
	"product_id" uuid,
	"quantity" integer,
	"customer_id" uuid,
	"goal_id" uuid,
	"ref_type" text,
	"ref_id" uuid,
	"reverses_id" uuid,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "journal_entries_op_id_unique" UNIQUE("op_id"),
	CONSTRAINT "journal_amount_ck" CHECK ("ukuphila"."journal_entries"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."kb_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" text NOT NULL,
	"section" text NOT NULL,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."kb_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"domain" text NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source" text NOT NULL,
	"authority" text NOT NULL,
	"effective_date" date,
	"review_date" date,
	"language" text DEFAULT 'pt-MZ' NOT NULL,
	"sensitivity" text DEFAULT 'internal' NOT NULL,
	"entities" jsonb NOT NULL,
	"keywords" jsonb NOT NULL,
	"body" text NOT NULL,
	"approved_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."kyc_attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."kyc_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_level" integer NOT NULL,
	"to_level" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."kyc_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'por_iniciar' NOT NULL,
	"face_captured" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"organisation" text,
	"market" text,
	"message" text,
	"status" text DEFAULT 'novo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."lease_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" text DEFAULT 'por_pagar' NOT NULL,
	"paid_at" timestamp with time zone,
	"entry_id" uuid
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"district" text NOT NULL,
	"city" text DEFAULT 'Maputo' NOT NULL,
	"stage" text DEFAULT 'planeado' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"blurb" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "markets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text DEFAULT 'inbox' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"status" text DEFAULT 'enviada' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."passports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"audience" text NOT NULL,
	"scope" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"signature" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passports_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "postings_nonzero_ck" CHECK ("ukuphila"."postings"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'unidade' NOT NULL,
	"icon" text DEFAULT 'caixa' NOT NULL,
	"market_category" text,
	"sale_price_cents" bigint,
	"avg_cost_cents" bigint DEFAULT 0 NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_at" integer DEFAULT 5 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"source_text" text NOT NULL,
	"intent" text NOT NULL,
	"payload" jsonb NOT NULL,
	"summary" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"op_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."read_receipts" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "read_receipts_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."readiness_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position" integer NOT NULL,
	"area" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'por_iniciar' NOT NULL,
	"owner" text,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."risk_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"subject_user_id" uuid,
	"market_id" uuid,
	"evidence" jsonb,
	"status" text DEFAULT 'aberto' NOT NULL,
	"case_id" uuid,
	"dedupe_key" text NOT NULL,
	"closed_by" uuid,
	"closure_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "risk_alerts_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."risk_case_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."risk_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"owner_id" uuid,
	"subject_user_id" uuid,
	"summary" text NOT NULL,
	"conclusion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "risk_cases_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."savings_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_cents" bigint NOT NULL,
	"target_date" date,
	"status" text DEFAULT 'activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_id" uuid,
	"user_agent" text,
	"mfa_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."stock_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"entry_id" uuid,
	"kind" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost_cents" bigint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."supplier_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"price_cents" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"phone" text,
	"city" text DEFAULT 'Maputo' NOT NULL,
	"status" text DEFAULT 'candidato' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."sync_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"op_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."sync_ops" (
	"op_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"device_seq" bigint,
	"prev_hash" text,
	"hash" text,
	"signature" text,
	"status" text NOT NULL,
	"result" jsonb,
	"client_time" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."trust_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"ring" integer NOT NULL,
	"readiness" text NOT NULL,
	"signals" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"role" text NOT NULL,
	"phone" text,
	"email" text,
	"display_name" text NOT NULL,
	"legal_name" text,
	"language" text DEFAULT 'pt-MZ' NOT NULL,
	"status" text DEFAULT 'preliminar' NOT NULL,
	"password_hash" text,
	"pin_hash" text,
	"pin_failures" integer DEFAULT 0 NOT NULL,
	"totp_secret" text,
	"totp_enabled_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_contact_ck" CHECK ("ukuphila"."users"."phone" is not null or "ukuphila"."users"."email" is not null)
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" text NOT NULL,
	"phone" text NOT NULL,
	"user_id" uuid,
	"body" text NOT NULL,
	"provider_id" text,
	"status" text DEFAULT 'registada' NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."xitique_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"declared_at" timestamp with time zone,
	"declared_by" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"late_days" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "xitique_two_people_ck" CHECK ("ukuphila"."xitique_contributions"."confirmed_by" is null or "ukuphila"."xitique_contributions"."declared_by" is null or "ukuphila"."xitique_contributions"."confirmed_by" <> "ukuphila"."xitique_contributions"."declared_by")
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."xitique_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid,
	"summary" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."xitique_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"market_id" uuid,
	"contribution_cents" bigint NOT NULL,
	"frequency" text NOT NULL,
	"payout_mode" text DEFAULT 'combinada' NOT NULL,
	"status" text DEFAULT 'formacao' NOT NULL,
	"rules" text,
	"draw_commit" text,
	"draw_seed" text,
	"starts_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xitique_groups_code_unique" UNIQUE("code"),
	CONSTRAINT "xitique_contribution_ck" CHECK ("ukuphila"."xitique_groups"."contribution_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."xitique_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"phone" text,
	"position" integer,
	"role" text DEFAULT 'membro' NOT NULL,
	"status" text DEFAULT 'activo' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ukuphila"."xitique_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"due_date" date NOT NULL,
	"recipient_member_id" uuid NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"paid_out_at" timestamp with time zone,
	"paid_out_confirmed_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ukuphila"."access_log" ADD CONSTRAINT "access_log_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."access_log" ADD CONSTRAINT "access_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."agent_earnings" ADD CONSTRAINT "agent_earnings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "ukuphila"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."agent_earnings" ADD CONSTRAINT "agent_earnings_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."agents" ADD CONSTRAINT "agents_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "ukuphila"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."ai_turns" ADD CONSTRAINT "ai_turns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."businesses" ADD CONSTRAINT "businesses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."businesses" ADD CONSTRAINT "businesses_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "ukuphila"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."businesses" ADD CONSTRAINT "businesses_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "ukuphila"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."consents" ADD CONSTRAINT "consents_captured_by_users_id_fk" FOREIGN KEY ("captured_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_applications" ADD CONSTRAINT "credit_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_applications" ADD CONSTRAINT "credit_applications_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "ukuphila"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_applications" ADD CONSTRAINT "credit_applications_policy_id_credit_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "ukuphila"."credit_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_contracts" ADD CONSTRAINT "credit_contracts_application_id_credit_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "ukuphila"."credit_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_contracts" ADD CONSTRAINT "credit_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_contracts" ADD CONSTRAINT "credit_contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "ukuphila"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_contracts" ADD CONSTRAINT "credit_contracts_delivery_confirmed_by_users_id_fk" FOREIGN KEY ("delivery_confirmed_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_decisions" ADD CONSTRAINT "credit_decisions_application_id_credit_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "ukuphila"."credit_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_decisions" ADD CONSTRAINT "credit_decisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_instalments" ADD CONSTRAINT "credit_instalments_contract_id_credit_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "ukuphila"."credit_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_policies" ADD CONSTRAINT "credit_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_policies" ADD CONSTRAINT "credit_policies_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_repayments" ADD CONSTRAINT "credit_repayments_contract_id_credit_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "ukuphila"."credit_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_repayments" ADD CONSTRAINT "credit_repayments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."credit_repayments" ADD CONSTRAINT "credit_repayments_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "ukuphila"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."device_leases" ADD CONSTRAINT "device_leases_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "ukuphila"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."device_leases" ADD CONSTRAINT "device_leases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."device_leases" ADD CONSTRAINT "device_leases_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "ukuphila"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."devices" ADD CONSTRAINT "devices_model_id_device_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "ukuphila"."device_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."document_blobs" ADD CONSTRAINT "document_blobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "ukuphila"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "ukuphila"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."document_events" ADD CONSTRAINT "document_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."documents" ADD CONSTRAINT "documents_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."documents" ADD CONSTRAINT "documents_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."entry_reviews" ADD CONSTRAINT "entry_reviews_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "ukuphila"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."entry_reviews" ADD CONSTRAINT "entry_reviews_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."incidents" ADD CONSTRAINT "incidents_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."incidents" ADD CONSTRAINT "incidents_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."incidents" ADD CONSTRAINT "incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."journal_entries" ADD CONSTRAINT "journal_entries_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "ukuphila"."kb_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."kb_documents" ADD CONSTRAINT "kb_documents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."kyc_attestations" ADD CONSTRAINT "kyc_attestations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."kyc_attestations" ADD CONSTRAINT "kyc_attestations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "ukuphila"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."kyc_events" ADD CONSTRAINT "kyc_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."kyc_events" ADD CONSTRAINT "kyc_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."kyc_profiles" ADD CONSTRAINT "kyc_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."lease_payments" ADD CONSTRAINT "lease_payments_lease_id_device_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "ukuphila"."device_leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."passports" ADD CONSTRAINT "passports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."postings" ADD CONSTRAINT "postings_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "ukuphila"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."postings" ADD CONSTRAINT "postings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "ukuphila"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."products" ADD CONSTRAINT "products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."proposals" ADD CONSTRAINT "proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_alerts" ADD CONSTRAINT "risk_alerts_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_alerts" ADD CONSTRAINT "risk_alerts_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "ukuphila"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_alerts" ADD CONSTRAINT "risk_alerts_case_id_risk_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "ukuphila"."risk_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_alerts" ADD CONSTRAINT "risk_alerts_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_case_notes" ADD CONSTRAINT "risk_case_notes_case_id_risk_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "ukuphila"."risk_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_case_notes" ADD CONSTRAINT "risk_case_notes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_cases" ADD CONSTRAINT "risk_cases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."risk_cases" ADD CONSTRAINT "risk_cases_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."savings_goals" ADD CONSTRAINT "savings_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."stock_moves" ADD CONSTRAINT "stock_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."stock_moves" ADD CONSTRAINT "stock_moves_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "ukuphila"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."stock_moves" ADD CONSTRAINT "stock_moves_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "ukuphila"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "ukuphila"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."suppliers" ADD CONSTRAINT "suppliers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."sync_conflicts" ADD CONSTRAINT "sync_conflicts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."sync_ops" ADD CONSTRAINT "sync_ops_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."sync_ops" ADD CONSTRAINT "sync_ops_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "ukuphila"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."trust_evaluations" ADD CONSTRAINT "trust_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."visits" ADD CONSTRAINT "visits_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "ukuphila"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."visits" ADD CONSTRAINT "visits_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "ukuphila"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_contributions" ADD CONSTRAINT "xitique_contributions_round_id_xitique_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "ukuphila"."xitique_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_contributions" ADD CONSTRAINT "xitique_contributions_member_id_xitique_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "ukuphila"."xitique_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_contributions" ADD CONSTRAINT "xitique_contributions_declared_by_users_id_fk" FOREIGN KEY ("declared_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_contributions" ADD CONSTRAINT "xitique_contributions_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_events" ADD CONSTRAINT "xitique_events_group_id_xitique_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "ukuphila"."xitique_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_events" ADD CONSTRAINT "xitique_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_groups" ADD CONSTRAINT "xitique_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_groups" ADD CONSTRAINT "xitique_groups_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "ukuphila"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_members" ADD CONSTRAINT "xitique_members_group_id_xitique_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "ukuphila"."xitique_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_members" ADD CONSTRAINT "xitique_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_rounds" ADD CONSTRAINT "xitique_rounds_group_id_xitique_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "ukuphila"."xitique_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_rounds" ADD CONSTRAINT "xitique_rounds_recipient_member_id_xitique_members_id_fk" FOREIGN KEY ("recipient_member_id") REFERENCES "ukuphila"."xitique_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ukuphila"."xitique_rounds" ADD CONSTRAINT "xitique_rounds_paid_out_confirmed_by_users_id_fk" FOREIGN KEY ("paid_out_confirmed_by") REFERENCES "ukuphila"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_log_subject_idx" ON "ukuphila"."access_log" USING btree ("subject_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_code_uq" ON "ukuphila"."accounts" USING btree ("user_id","code");--> statement-breakpoint
CREATE INDEX "agent_earnings_idx" ON "ukuphila"."agent_earnings" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_turns_time_idx" ON "ukuphila"."ai_turns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_turns_user_idx" ON "ukuphila"."ai_turns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "ukuphila"."audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "ukuphila"."audit_events" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "ukuphila"."audit_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "businesses_market_idx" ON "ukuphila"."businesses" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "businesses_agent_idx" ON "ukuphila"."businesses" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "ukuphila"."consents" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "credit_app_status_idx" ON "ukuphila"."credit_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_app_user_idx" ON "ukuphila"."credit_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_contract_user_idx" ON "ukuphila"."credit_contracts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_contract_status_idx" ON "ukuphila"."credit_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_decisions_app_idx" ON "ukuphila"."credit_decisions" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_instalment_uq" ON "ukuphila"."credit_instalments" USING btree ("contract_id","number");--> statement-breakpoint
CREATE INDEX "credit_instalment_due_idx" ON "ukuphila"."credit_instalments" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_policy_one_active_uq" ON "ukuphila"."credit_policies" USING btree ("status") WHERE "ukuphila"."credit_policies"."status" = 'aprovada';--> statement-breakpoint
CREATE INDEX "credit_repayment_contract_idx" ON "ukuphila"."credit_repayments" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_name_uq" ON "ukuphila"."customers" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "device_leases_user_idx" ON "ukuphila"."device_leases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "ukuphila"."devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_events_doc_idx" ON "ukuphila"."document_events" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "ukuphila"."documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "ukuphila"."documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entry_reviews_entry_idx" ON "ukuphila"."entry_reviews" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "ukuphila"."incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_subject_idx" ON "ukuphila"."incidents" USING btree ("subject_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_user_seq_uq" ON "ukuphila"."journal_entries" USING btree ("user_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_reversal_uq" ON "ukuphila"."journal_entries" USING btree ("reverses_id") WHERE "ukuphila"."journal_entries"."reverses_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_user_time_idx" ON "ukuphila"."journal_entries" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "journal_kind_time_idx" ON "ukuphila"."journal_entries" USING btree ("kind","occurred_at");--> statement-breakpoint
CREATE INDEX "kb_chunks_doc_idx" ON "ukuphila"."kb_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "kyc_attest_user_idx" ON "ukuphila"."kyc_attestations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kyc_events_user_idx" ON "ukuphila"."kyc_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "ukuphila"."leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lease_payment_uq" ON "ukuphila"."lease_payments" USING btree ("lease_id","number");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "ukuphila"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "ukuphila"."otp_challenges" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "passports_user_idx" ON "ukuphila"."passports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "postings_account_idx" ON "ukuphila"."postings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "postings_entry_idx" ON "ukuphila"."postings" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_user_name_uq" ON "ukuphila"."products" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "proposals_user_idx" ON "ukuphila"."proposals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "risk_alerts_status_idx" ON "ukuphila"."risk_alerts" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "risk_case_notes_idx" ON "ukuphila"."risk_case_notes" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "risk_cases_status_idx" ON "ukuphila"."risk_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "savings_goals_user_idx" ON "ukuphila"."savings_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "ukuphila"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_moves_product_idx" ON "ukuphila"."stock_moves" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "supplier_products_idx" ON "ukuphila"."supplier_products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "sync_conflicts_status_idx" ON "ukuphila"."sync_conflicts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_ops_user_idx" ON "ukuphila"."sync_ops" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "sync_ops_status_idx" ON "ukuphila"."sync_ops" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trust_eval_user_idx" ON "ukuphila"."trust_evaluations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "ukuphila"."users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "visits_agent_idx" ON "ukuphila"."visits" USING btree ("agent_id","at");--> statement-breakpoint
CREATE INDEX "wa_phone_idx" ON "ukuphila"."whatsapp_messages" USING btree ("phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_provider_uq" ON "ukuphila"."whatsapp_messages" USING btree ("provider_id") WHERE "ukuphila"."whatsapp_messages"."provider_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "xitique_contribution_uq" ON "ukuphila"."xitique_contributions" USING btree ("round_id","member_id");--> statement-breakpoint
CREATE INDEX "xitique_events_group_idx" ON "ukuphila"."xitique_events" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "xitique_member_user_uq" ON "ukuphila"."xitique_members" USING btree ("group_id","user_id") WHERE "ukuphila"."xitique_members"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "xitique_member_position_uq" ON "ukuphila"."xitique_members" USING btree ("group_id","position") WHERE "ukuphila"."xitique_members"."position" is not null;--> statement-breakpoint
CREATE INDEX "xitique_members_user_idx" ON "ukuphila"."xitique_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xitique_round_uq" ON "ukuphila"."xitique_rounds" USING btree ("group_id","number");
CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "triggerType" TEXT NOT NULL,
  "triggerConfig" JSONB NOT NULL,
  "conditionMode" TEXT NOT NULL DEFAULT 'all',
  "conditions" JSONB NOT NULL,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "createdByAccountId" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationAction" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRule_agencyId_active_triggerType_idx" ON "AutomationRule"("agencyId", "active", "triggerType");
CREATE INDEX "AutomationRule_agencyId_createdAt_idx" ON "AutomationRule"("agencyId", "createdAt");
CREATE INDEX "AutomationAction_ruleId_sortOrder_idx" ON "AutomationAction"("ruleId", "sortOrder");
CREATE UNIQUE INDEX "AutomationRun_ruleId_eventKey_key" ON "AutomationRun"("ruleId", "eventKey");
CREATE INDEX "AutomationRun_agencyId_status_createdAt_idx" ON "AutomationRun"("agencyId", "status", "createdAt");
CREATE INDEX "AutomationRun_status_nextRetryAt_idx" ON "AutomationRun"("status", "nextRetryAt");
CREATE INDEX "AutomationRun_entityType_entityId_idx" ON "AutomationRun"("entityType", "entityId");

ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "TourAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter customers table to add contract details (date, terms, amount)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_terms TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_amount BIGINT;

-- Add brief comments to the columns for developer documentation
COMMENT ON COLUMN customers.contract_date IS '거래처와의 유지보수 계약 시작/갱신일';
COMMENT ON COLUMN customers.contract_terms IS '유지보수 계약 조건 및 범위 (예: 월 1회 정기점검)';
COMMENT ON COLUMN customers.contract_amount IS '유지보수 계약 금액 (연/월 단위 정액 금액)';

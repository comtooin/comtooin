-- requests 테이블의 user_name 컬럼에 걸린 NOT NULL 제약조건 해제
ALTER TABLE public.requests ALTER COLUMN user_name DROP NOT NULL;

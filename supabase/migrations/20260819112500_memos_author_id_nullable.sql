-- memos 테이블의 author_id 컬럼에 걸린 NOT NULL 제약조건 해제
ALTER TABLE public.memos ALTER COLUMN author_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION hash_password(plaintext_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN crypt(plaintext_password, gen_salt('bf'));
END;
$$;
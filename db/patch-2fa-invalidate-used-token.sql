-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE public.user
    ADD twofa_last_token VARCHAR(6);

COMMIT;

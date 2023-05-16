BEGIN TRANSACTION;

 ALTER TABLE public.monitor
     ADD database_connection_string VARCHAR(2000);

 ALTER TABLE public.monitor
     ADD database_query TEXT;


 COMMIT

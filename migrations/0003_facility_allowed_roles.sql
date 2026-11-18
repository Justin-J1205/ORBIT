UPDATE public."facilities"
SET "allowed_roles" = ARRAY['faculty', 'admin']::varchar[]
WHERE "name" ~* '(board[[:space:]]*room|lounge)'
  AND "allowed_roles" = ARRAY['student', 'faculty']::varchar[];

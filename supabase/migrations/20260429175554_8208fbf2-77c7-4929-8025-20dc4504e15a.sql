-- Aumentar limite do bucket audio-files de 100MB para 700MB para suportar gravações de até 2h
UPDATE storage.buckets 
SET file_size_limit = 734003200  -- 700 MB
WHERE id = 'audio-files';
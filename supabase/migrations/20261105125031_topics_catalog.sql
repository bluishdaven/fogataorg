-- The topic catalog writers choose from when publishing (up to 5 per story). It used to come only
-- from the demo seed, so production had none. Re-running is safe: existing slugs keep their id
-- (and their stories) and only get the names below.
insert into public.topics (slug, name_en, name_es) values
  -- From the original seed catalog.
  ('books', 'Books', 'Libros'),
  ('cities', 'Cities', 'Ciudades'),
  ('design', 'Design', 'Diseño'),
  ('family', 'Family', 'Familia'),
  ('food', 'Food', 'Comida'),
  ('language', 'Language', 'Idiomas'),
  ('memory', 'Memory', 'Memoria'),
  ('migration', 'Migration', 'Migración'),
  ('music', 'Music', 'Música'),
  ('nature', 'Nature', 'Naturaleza'),
  ('technology', 'Technology', 'Tecnología'),
  ('travel', 'Travel', 'Viajes'),
  ('work', 'Work', 'Trabajo'),
  ('writing', 'Writing', 'Escritura'),
  -- Forms.
  ('fiction', 'Fiction', 'Ficción'),
  ('poetry', 'Poetry', 'Poesía'),
  ('personal-essays', 'Personal essays', 'Ensayo personal'),
  ('humor', 'Humor', 'Humor'),
  -- Arts and culture.
  ('art', 'Art', 'Arte'),
  ('film', 'Film', 'Cine'),
  ('photography', 'Photography', 'Fotografía'),
  ('culture', 'Culture', 'Cultura'),
  ('history', 'History', 'Historia'),
  ('philosophy', 'Philosophy', 'Filosofía'),
  -- Life.
  ('relationships', 'Relationships', 'Relaciones'),
  ('parenting', 'Parenting', 'Crianza'),
  ('health', 'Health', 'Salud'),
  ('mental-health', 'Mental health', 'Salud mental'),
  ('identity', 'Identity', 'Identidad'),
  ('spirituality', 'Spirituality', 'Espiritualidad'),
  ('education', 'Education', 'Educación'),
  ('sports', 'Sports', 'Deportes'),
  -- World.
  ('society', 'Society', 'Sociedad'),
  ('science', 'Science', 'Ciencia'),
  ('environment', 'Environment', 'Medio ambiente'),
  ('business', 'Business', 'Negocios'),
  ('money', 'Money', 'Dinero'),
  ('journalism', 'Journalism', 'Periodismo'),
  ('latin-america', 'Latin America', 'Latinoamérica')
on conflict (slug) do update set
  name_en = excluded.name_en,
  name_es = excluded.name_es;

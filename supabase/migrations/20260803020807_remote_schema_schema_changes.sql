-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE EXTENSION btree_gist WITH SCHEMA public;

ALTER TYPE public.event_type ADD VALUE 'room_reservation' AFTER 'other';

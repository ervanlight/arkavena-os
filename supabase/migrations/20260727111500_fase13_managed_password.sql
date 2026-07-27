-- Migration: Tambah kolom managed_password ke tabel users untuk menyimpan password sementara/managed yang dapat dilihat dan dikelola oleh Admin/CS.

alter table users add column if not exists managed_password text;
comment on column users.managed_password is 'Password yang dapat dilihat/direset oleh admin untuk disampaikan kepada pengguna (klien/subkon/pengawas).';

-- Fase 13 Wave 0: tambah role photo_uploader ke enum project_role.
-- Role ini digunakan untuk anggota tim bawahan subkontraktor yang
-- hanya boleh upload foto dan melihat riwayat upload mereka sendiri.
-- Tidak boleh akses data proyek lainnya.

alter type project_role add value if not exists 'photo_uploader';

-- FlorzyAngel Enterprise — Database Repair & RPC Upgrade Script
-- Run this script in the Supabase SQL Editor to correct the imported sales, journal entries, and upgrade the RPC function.

-- 1. Ensure the sales table has the invoice_no column, drop identity/null constraints, and set type to TEXT
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE public.sales ALTER COLUMN invoice_no DROP IDENTITY IF EXISTS;
ALTER TABLE public.sales ALTER COLUMN invoice_no DROP NOT NULL;
ALTER TABLE public.sales ALTER COLUMN invoice_no TYPE TEXT;

-- 2. Update imported sales with correct dates and invoice numbers
WITH csv_data (row_num, new_date, new_invoice) AS (
  VALUES
    (1, '2025-09-23 00:00:00+00'::timestamptz, 'PINV-0001'),
    (2, '2025-09-23 00:00:00+00'::timestamptz, 'PINV-0002'),
    (3, '2025-09-23 00:00:00+00'::timestamptz, 'PINV-0003'),
    (4, '2025-09-23 00:00:00+00'::timestamptz, 'PINV-0004'),
    (5, '2025-09-23 00:00:00+00'::timestamptz, 'PINV-0005'),
    (6, '2025-09-23 00:00:00+00'::timestamptz, 'PINV-0006'),
    (7, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0007'),
    (8, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0008'),
    (9, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0009'),
    (10, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0010'),
    (11, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0011'),
    (12, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0012'),
    (13, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0013'),
    (14, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0014'),
    (15, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0015'),
    (16, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0016'),
    (17, '2025-09-24 00:00:00+00'::timestamptz, 'PINV-0017'),
    (18, '2025-09-25 00:00:00+00'::timestamptz, 'PINV-0018'),
    (19, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0019'),
    (20, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0020'),
    (21, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0021'),
    (22, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0022'),
    (23, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0023'),
    (24, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0024'),
    (25, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0025'),
    (26, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0026'),
    (27, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0027'),
    (28, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0028'),
    (29, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0029'),
    (30, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0030'),
    (31, '2025-09-26 00:00:00+00'::timestamptz, 'PINV-0031'),
    (32, '2025-09-29 00:00:00+00'::timestamptz, 'PINV-0032'),
    (33, '2025-09-29 00:00:00+00'::timestamptz, 'PINV-0033'),
    (34, '2025-09-29 00:00:00+00'::timestamptz, 'PINV-0034'),
    (35, '2025-09-29 00:00:00+00'::timestamptz, 'PINV-0035'),
    (36, '2025-09-30 00:00:00+00'::timestamptz, 'PINV-0036'),
    (37, '2025-09-30 00:00:00+00'::timestamptz, 'PINV-0037'),
    (38, '2025-10-01 00:00:00+00'::timestamptz, 'PINV-0038'),
    (39, '2025-10-01 00:00:00+00'::timestamptz, 'PINV-0039'),
    (40, '2025-10-02 00:00:00+00'::timestamptz, 'PINV-0040'),
    (41, '2025-10-02 00:00:00+00'::timestamptz, 'PINV-0041'),
    (42, '2025-10-02 00:00:00+00'::timestamptz, 'PINV-0042'),
    (43, '2025-10-02 00:00:00+00'::timestamptz, 'PINV-0043'),
    (44, '2025-10-02 00:00:00+00'::timestamptz, 'PINV-0044'),
    (45, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0045'),
    (46, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0046'),
    (47, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0047'),
    (48, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0048'),
    (49, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0049'),
    (50, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0050'),
    (51, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0051'),
    (52, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0052'),
    (53, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0053'),
    (54, '2025-10-06 00:00:00+00'::timestamptz, 'PINV-0054'),
    (55, '2025-10-06 00:00:00+00'::timestamptz, 'PINV-0055'),
    (56, '2025-10-06 00:00:00+00'::timestamptz, 'PINV-0056'),
    (57, '2025-10-06 00:00:00+00'::timestamptz, 'PINV-0057'),
    (58, '2025-10-06 00:00:00+00'::timestamptz, 'PINV-0058'),
    (59, '2025-10-07 00:00:00+00'::timestamptz, 'PINV-0059'),
    (60, '2025-10-08 00:00:00+00'::timestamptz, 'PINV-0060'),
    (61, '2025-10-09 00:00:00+00'::timestamptz, 'PINV-0061'),
    (62, '2025-10-09 00:00:00+00'::timestamptz, 'PINV-0062'),
    (63, '2025-10-09 00:00:00+00'::timestamptz, 'PINV-0063'),
    (64, '2025-10-09 00:00:00+00'::timestamptz, 'PINV-0064'),
    (65, '2025-10-10 00:00:00+00'::timestamptz, 'PINV-0065'),
    (66, '2025-10-10 00:00:00+00'::timestamptz, 'PINV-0066'),
    (67, '2025-10-10 00:00:00+00'::timestamptz, 'PINV-0067'),
    (68, '2025-10-10 00:00:00+00'::timestamptz, 'PINV-0068'),
    (69, '2025-10-10 00:00:00+00'::timestamptz, 'PINV-0069'),
    (70, '2025-10-10 00:00:00+00'::timestamptz, 'PINV-0070'),
    (71, '2025-10-10 00:00:00+00'::timestamptz, 'PINV-0071'),
    (72, '2025-10-12 00:00:00+00'::timestamptz, 'PINV-0072'),
    (73, '2025-10-13 00:00:00+00'::timestamptz, 'PINV-0073'),
    (74, '2025-10-13 00:00:00+00'::timestamptz, 'PINV-0074'),
    (75, '2025-10-13 00:00:00+00'::timestamptz, 'PINV-0075'),
    (76, '2025-10-13 00:00:00+00'::timestamptz, 'PINV-0076'),
    (77, '2025-10-13 00:00:00+00'::timestamptz, 'PINV-0077'),
    (78, '2025-10-13 00:00:00+00'::timestamptz, 'PINV-0078'),
    (79, '2025-10-14 00:00:00+00'::timestamptz, 'PINV-0079'),
    (80, '2025-10-14 00:00:00+00'::timestamptz, 'PINV-0080'),
    (81, '2025-10-14 00:00:00+00'::timestamptz, 'PINV-0081'),
    (82, '2025-10-14 00:00:00+00'::timestamptz, 'PINV-0082'),
    (83, '2025-10-14 00:00:00+00'::timestamptz, 'PINV-0083'),
    (84, '2025-10-14 00:00:00+00'::timestamptz, 'PINV-0084'),
    (85, '2025-10-15 00:00:00+00'::timestamptz, 'PINV-0085'),
    (86, '2025-10-15 00:00:00+00'::timestamptz, 'PINV-0086'),
    (87, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0087'),
    (88, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0088'),
    (89, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0089'),
    (90, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0090'),
    (91, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0091'),
    (92, '2025-10-05 00:00:00+00'::timestamptz, 'PINV-0092'),
    (93, '2025-10-17 00:00:00+00'::timestamptz, 'PINV-0093'),
    (94, '2025-10-17 00:00:00+00'::timestamptz, 'PINV-0094'),
    (95, '2025-10-17 00:00:00+00'::timestamptz, 'PINV-0095'),
    (96, '2025-10-19 00:00:00+00'::timestamptz, 'PINV-0096'),
    (97, '2025-10-19 00:00:00+00'::timestamptz, 'PINV-0097'),
    (98, '2025-10-20 00:00:00+00'::timestamptz, 'PINV-0098'),
    (99, '2025-10-20 00:00:00+00'::timestamptz, 'PINV-0099'),
    (100, '2025-10-20 00:00:00+00'::timestamptz, 'PINV-0100'),
    (101, '2025-10-21 00:00:00+00'::timestamptz, 'PINV-0101'),
    (102, '2025-10-21 00:00:00+00'::timestamptz, 'PINV-0102'),
    (103, '2025-10-21 00:00:00+00'::timestamptz, 'PINV-0103'),
    (104, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0104'),
    (105, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0105'),
    (106, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0106'),
    (107, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0107'),
    (108, '2025-10-23 00:00:00+00'::timestamptz, 'PINV-0108'),
    (109, '2025-10-23 00:00:00+00'::timestamptz, 'PINV-0109'),
    (110, '2025-10-23 00:00:00+00'::timestamptz, 'PINV-0110'),
    (111, '2025-10-23 00:00:00+00'::timestamptz, 'PINV-0111'),
    (112, '2025-10-24 00:00:00+00'::timestamptz, 'PINV-0112'),
    (113, '2025-10-27 00:00:00+00'::timestamptz, 'PINV-0113'),
    (114, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0114'),
    (115, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0115'),
    (116, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0116'),
    (117, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0117'),
    (118, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0118'),
    (119, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0119'),
    (120, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0120'),
    (121, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0121'),
    (122, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0122'),
    (123, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0123'),
    (124, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0124'),
    (125, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0125'),
    (126, '2025-10-28 00:00:00+00'::timestamptz, 'PINV-0126'),
    (127, '2025-10-29 00:00:00+00'::timestamptz, 'PINV-0127'),
    (128, '2025-10-29 00:00:00+00'::timestamptz, 'PINV-0128'),
    (129, '2025-10-29 00:00:00+00'::timestamptz, 'PINV-0129'),
    (130, '2025-10-29 00:00:00+00'::timestamptz, 'PINV-0130'),
    (131, '2025-10-30 00:00:00+00'::timestamptz, 'PINV-0131'),
    (132, '2025-10-30 00:00:00+00'::timestamptz, 'PINV-0132'),
    (133, '2025-10-30 00:00:00+00'::timestamptz, 'PINV-0133'),
    (134, '2025-10-30 00:00:00+00'::timestamptz, 'PINV-0134'),
    (135, '2025-10-30 00:00:00+00'::timestamptz, 'PINV-0135'),
    (136, '2025-10-30 00:00:00+00'::timestamptz, 'PINV-0136'),
    (137, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0137'),
    (138, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0138'),
    (139, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0139'),
    (140, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0140'),
    (141, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0141'),
    (142, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0142'),
    (143, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0143'),
    (144, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0144'),
    (145, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0145'),
    (146, '2025-10-03 00:00:00+00'::timestamptz, 'PINV-0146'),
    (147, '2025-11-03 00:00:00+00'::timestamptz, 'PINV-0147'),
    (148, '2025-11-03 00:00:00+00'::timestamptz, 'PINV-0148'),
    (149, '2025-11-03 00:00:00+00'::timestamptz, 'PINV-0149'),
    (150, '2025-11-03 00:00:00+00'::timestamptz, 'PINV-0150'),
    (151, '2025-11-03 00:00:00+00'::timestamptz, 'PINV-0151'),
    (152, '2025-11-03 00:00:00+00'::timestamptz, 'PINV-0152'),
    (153, '2025-11-03 00:00:00+00'::timestamptz, 'PINV-0153'),
    (154, '2025-11-04 00:00:00+00'::timestamptz, 'PINV-0154'),
    (155, '2025-11-04 00:00:00+00'::timestamptz, 'PINV-0155'),
    (156, '2025-11-04 00:00:00+00'::timestamptz, 'PINV-0156'),
    (157, '2025-11-04 00:00:00+00'::timestamptz, 'PINV-0157'),
    (158, '2025-11-04 00:00:00+00'::timestamptz, 'PINV-0158'),
    (159, '2025-11-04 00:00:00+00'::timestamptz, 'PINV-0159'),
    (160, '2025-11-04 00:00:00+00'::timestamptz, 'PINV-0160'),
    (161, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0161'),
    (162, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0162'),
    (163, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0163'),
    (164, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0164'),
    (165, '2025-11-05 00:00:00+00'::timestamptz, 'PINV-0165'),
    (166, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0166'),
    (167, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0167'),
    (168, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0168'),
    (169, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0169'),
    (170, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0170'),
    (171, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0171'),
    (172, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0172'),
    (173, '2025-11-06 00:00:00+00'::timestamptz, 'PINV-0173'),
    (174, '2025-11-07 00:00:00+00'::timestamptz, 'PINV-0174'),
    (175, '2025-11-07 00:00:00+00'::timestamptz, 'PINV-0175'),
    (176, '2025-11-07 00:00:00+00'::timestamptz, 'PINV-0176'),
    (177, '2025-11-09 00:00:00+00'::timestamptz, 'PINV-0177'),
    (178, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0178'),
    (179, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0179'),
    (180, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0180'),
    (181, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0181'),
    (182, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0182'),
    (183, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0183'),
    (184, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0184'),
    (185, '2025-11-10 00:00:00+00'::timestamptz, 'PINV-0185'),
    (186, '2025-11-11 00:00:00+00'::timestamptz, 'PINV-0186'),
    (187, '2025-11-11 00:00:00+00'::timestamptz, 'PINV-0187'),
    (188, '2025-11-11 00:00:00+00'::timestamptz, 'PINV-0188'),
    (189, '2025-11-11 00:00:00+00'::timestamptz, 'PINV-0189'),
    (190, '2025-11-11 00:00:00+00'::timestamptz, 'PINV-0190'),
    (191, '2025-11-13 00:00:00+00'::timestamptz, 'PINV-0191'),
    (192, '2025-11-13 00:00:00+00'::timestamptz, 'PINV-0192'),
    (193, '2025-11-13 00:00:00+00'::timestamptz, 'PINV-0193'),
    (194, '2025-11-13 00:00:00+00'::timestamptz, 'PINV-0194'),
    (195, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0195'),
    (196, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0196'),
    (197, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0197'),
    (198, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0198'),
    (199, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0199'),
    (200, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0200'),
    (201, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0201'),
    (202, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0202'),
    (203, '2025-11-14 00:00:00+00'::timestamptz, 'PINV-0203'),
    (204, '2025-11-16 00:00:00+00'::timestamptz, 'PINV-0204'),
    (205, '2025-11-16 00:00:00+00'::timestamptz, 'PINV-0205'),
    (206, '2025-11-16 00:00:00+00'::timestamptz, 'PINV-0206'),
    (207, '2025-11-16 00:00:00+00'::timestamptz, 'PINV-0207'),
    (208, '2025-11-17 00:00:00+00'::timestamptz, 'PINV-0208'),
    (209, '2025-11-18 00:00:00+00'::timestamptz, 'PINV-0209'),
    (210, '2025-11-18 00:00:00+00'::timestamptz, 'PINV-0210'),
    (211, '2025-11-19 00:00:00+00'::timestamptz, 'PINV-0211'),
    (212, '2025-11-19 00:00:00+00'::timestamptz, 'PINV-0212'),
    (213, '2025-11-19 00:00:00+00'::timestamptz, 'PINV-0213'),
    (214, '2025-11-19 00:00:00+00'::timestamptz, 'PINV-0214'),
    (215, '2025-11-19 00:00:00+00'::timestamptz, 'PINV-0215'),
    (216, '2025-11-20 00:00:00+00'::timestamptz, 'PINV-0216'),
    (217, '2025-11-20 00:00:00+00'::timestamptz, 'PINV-0217'),
    (218, '2025-11-20 00:00:00+00'::timestamptz, 'PINV-0218'),
    (219, '2025-11-20 00:00:00+00'::timestamptz, 'PINV-0219'),
    (220, '2025-11-20 00:00:00+00'::timestamptz, 'PINV-0220'),
    (221, '2025-08-01 00:00:00+00'::timestamptz, 'PINV-0221'),
    (222, '2025-08-03 00:00:00+00'::timestamptz, 'PINV-0222'),
    (223, '2025-08-04 00:00:00+00'::timestamptz, 'PINV-0223'),
    (224, '2025-08-05 00:00:00+00'::timestamptz, 'PINV-0224'),
    (225, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0225'),
    (226, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0226'),
    (227, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0227'),
    (228, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0228'),
    (229, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0229'),
    (230, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0230'),
    (231, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0231'),
    (232, '2025-08-06 00:00:00+00'::timestamptz, 'PINV-0232'),
    (233, '2025-08-07 00:00:00+00'::timestamptz, 'PINV-0233'),
    (234, '2025-08-07 00:00:00+00'::timestamptz, 'PINV-0234'),
    (235, '2025-08-07 00:00:00+00'::timestamptz, 'PINV-0235'),
    (236, '2025-08-07 00:00:00+00'::timestamptz, 'PINV-0236'),
    (237, '2025-08-07 00:00:00+00'::timestamptz, 'PINV-0237'),
    (238, '2025-08-07 00:00:00+00'::timestamptz, 'PINV-0238'),
    (239, '2025-08-11 00:00:00+00'::timestamptz, 'PINV-0239'),
    (240, '2025-08-12 00:00:00+00'::timestamptz, 'PINV-0240'),
    (241, '2025-08-12 00:00:00+00'::timestamptz, 'PINV-0241'),
    (242, '2025-08-13 00:00:00+00'::timestamptz, 'PINV-0242'),
    (243, '2025-08-13 00:00:00+00'::timestamptz, 'PINV-0243'),
    (244, '2025-08-13 00:00:00+00'::timestamptz, 'PINV-0244'),
    (245, '2025-08-13 00:00:00+00'::timestamptz, 'PINV-0245'),
    (246, '2025-08-14 00:00:00+00'::timestamptz, 'PINV-0246'),
    (247, '2025-08-14 00:00:00+00'::timestamptz, 'PINV-0247'),
    (248, '2025-08-14 00:00:00+00'::timestamptz, 'PINV-0248'),
    (249, '2025-08-14 00:00:00+00'::timestamptz, 'PINV-0249'),
    (250, '2025-11-28 00:00:00+00'::timestamptz, 'PINV-0250'),
    (251, '2025-11-28 00:00:00+00'::timestamptz, 'PINV-0251'),
    (252, '2025-11-28 00:00:00+00'::timestamptz, 'PINV-0252'),
    (253, '2025-11-21 00:00:00+00'::timestamptz, 'PINV-0253'),
    (254, '2025-11-21 00:00:00+00'::timestamptz, 'PINV-0254'),
    (255, '2025-11-21 00:00:00+00'::timestamptz, 'PINV-0255'),
    (256, '2025-11-21 00:00:00+00'::timestamptz, 'PINV-0256'),
    (257, '2025-11-22 00:00:00+00'::timestamptz, 'PINV-0257'),
    (258, '2025-11-22 00:00:00+00'::timestamptz, 'PINV-0258'),
    (259, '2025-11-22 00:00:00+00'::timestamptz, 'PINV-0259'),
    (260, '2025-11-24 00:00:00+00'::timestamptz, 'PINV-0260'),
    (261, '2025-11-24 00:00:00+00'::timestamptz, 'PINV-0261'),
    (262, '2025-11-25 00:00:00+00'::timestamptz, 'PINV-0262'),
    (263, '2025-11-25 00:00:00+00'::timestamptz, 'PINV-0263'),
    (264, '2025-11-26 00:00:00+00'::timestamptz, 'PINV-0264'),
    (265, '2025-11-26 00:00:00+00'::timestamptz, 'PINV-0265'),
    (266, '2025-11-27 00:00:00+00'::timestamptz, 'PINV-0266'),
    (267, '2025-11-27 00:00:00+00'::timestamptz, 'PINV-0267'),
    (268, '2025-11-28 00:00:00+00'::timestamptz, 'PINV-0268'),
    (269, '2025-11-28 00:00:00+00'::timestamptz, 'PINV-0269'),
    (270, '2025-12-01 00:00:00+00'::timestamptz, 'PINV-0270'),
    (271, '2025-12-01 00:00:00+00'::timestamptz, 'PINV-0271'),
    (272, '2025-12-01 00:00:00+00'::timestamptz, 'PINV-0272'),
    (273, '2025-12-01 00:00:00+00'::timestamptz, 'PINV-0273'),
    (274, '2025-12-02 00:00:00+00'::timestamptz, 'PINV-0274'),
    (275, '2025-12-02 00:00:00+00'::timestamptz, 'PINV-0275'),
    (276, '2025-12-02 00:00:00+00'::timestamptz, 'PINV-0276'),
    (277, '2025-12-02 00:00:00+00'::timestamptz, 'PINV-0277'),
    (278, '2025-12-02 00:00:00+00'::timestamptz, 'PINV-0278'),
    (279, '2025-12-02 00:00:00+00'::timestamptz, 'PINV-0279'),
    (280, '2025-12-02 00:00:00+00'::timestamptz, 'PINV-0280'),
    (281, '2025-12-03 00:00:00+00'::timestamptz, 'PINV-0281'),
    (282, '2025-12-03 00:00:00+00'::timestamptz, 'PINV-0282'),
    (283, '2025-12-03 00:00:00+00'::timestamptz, 'PINV-0283'),
    (284, '2025-12-03 00:00:00+00'::timestamptz, 'PINV-0284'),
    (285, '2025-12-03 00:00:00+00'::timestamptz, 'PINV-0285'),
    (286, '2025-12-04 00:00:00+00'::timestamptz, 'PINV-0286'),
    (287, '2025-12-04 00:00:00+00'::timestamptz, 'PINV-0287'),
    (288, '2025-12-04 00:00:00+00'::timestamptz, 'PINV-0288'),
    (289, '2025-12-04 00:00:00+00'::timestamptz, 'PINV-0289'),
    (290, '2025-12-04 00:00:00+00'::timestamptz, 'PINV-0290'),
    (291, '2025-12-04 00:00:00+00'::timestamptz, 'PINV-0291'),
    (292, '2025-12-05 00:00:00+00'::timestamptz, 'PINV-0292'),
    (293, '2025-12-05 00:00:00+00'::timestamptz, 'PINV-0293'),
    (294, '2025-12-05 00:00:00+00'::timestamptz, 'PINV-0294'),
    (295, '2025-12-05 00:00:00+00'::timestamptz, 'PINV-0295'),
    (296, '2025-12-05 00:00:00+00'::timestamptz, 'PINV-0296'),
    (297, '2025-12-05 00:00:00+00'::timestamptz, 'PINV-0297'),
    (298, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0298'),
    (299, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0299'),
    (300, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0300'),
    (301, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0301'),
    (302, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0302'),
    (303, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0303'),
    (304, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0304'),
    (305, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0305'),
    (306, '2025-12-08 00:00:00+00'::timestamptz, 'PINV-0306'),
    (307, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0307'),
    (308, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0308'),
    (309, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0309'),
    (310, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0310'),
    (311, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0311'),
    (312, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0312'),
    (313, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0313'),
    (314, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0314'),
    (315, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0315'),
    (316, '2023-12-09 00:00:00+00'::timestamptz, 'PINV-0316'),
    (317, '2025-12-26 00:00:00+00'::timestamptz, 'PINV-0317'),
    (318, '2025-12-26 00:00:00+00'::timestamptz, 'PINV-0318'),
    (319, '2025-12-26 00:00:00+00'::timestamptz, 'PINV-0319'),
    (320, '2025-12-26 00:00:00+00'::timestamptz, 'PINV-0320'),
    (321, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0321'),
    (322, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0322'),
    (323, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0323'),
    (324, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0324'),
    (325, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0325'),
    (326, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0326'),
    (327, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0327'),
    (328, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0328'),
    (329, '2025-12-11 00:00:00+00'::timestamptz, 'PINV-0329'),
    (330, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0330'),
    (331, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0331'),
    (332, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0332'),
    (333, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0333'),
    (334, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0334'),
    (335, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0335'),
    (336, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0336'),
    (337, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0337'),
    (338, '2025-12-12 00:00:00+00'::timestamptz, 'PINV-0338'),
    (339, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0339'),
    (340, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0340'),
    (341, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0341'),
    (342, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0342'),
    (343, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0343'),
    (344, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0344'),
    (345, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0345'),
    (346, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0346'),
    (347, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0347'),
    (348, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0348'),
    (349, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0349'),
    (350, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0350'),
    (351, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0351'),
    (352, '2025-12-16 00:00:00+00'::timestamptz, 'PINV-0352'),
    (353, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0353'),
    (354, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0354'),
    (355, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0355'),
    (356, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0356'),
    (357, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0357'),
    (358, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0358'),
    (359, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0359'),
    (360, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0360'),
    (361, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0361'),
    (362, '2025-12-17 00:00:00+00'::timestamptz, 'PINV-0362'),
    (363, '2025-12-18 00:00:00+00'::timestamptz, 'PINV-0363'),
    (364, '2025-12-18 00:00:00+00'::timestamptz, 'PINV-0364'),
    (365, '2025-12-18 00:00:00+00'::timestamptz, 'PINV-0365'),
    (366, '2025-12-18 00:00:00+00'::timestamptz, 'PINV-0366'),
    (367, '2025-12-18 00:00:00+00'::timestamptz, 'PINV-0367'),
    (368, '2025-12-19 00:00:00+00'::timestamptz, 'PINV-0368'),
    (369, '2025-12-19 00:00:00+00'::timestamptz, 'PINV-0369'),
    (370, '2025-12-19 00:00:00+00'::timestamptz, 'PINV-0370'),
    (371, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0371'),
    (372, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0372'),
    (373, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0373'),
    (374, '2025-10-22 00:00:00+00'::timestamptz, 'PINV-0374'),
    (375, '2025-12-23 00:00:00+00'::timestamptz, 'PINV-0375'),
    (376, '2025-12-23 00:00:00+00'::timestamptz, 'PINV-0376'),
    (377, '2025-12-23 00:00:00+00'::timestamptz, 'PINV-0377'),
    (378, '2025-12-23 00:00:00+00'::timestamptz, 'PINV-0378'),
    (379, '2025-12-24 00:00:00+00'::timestamptz, 'PINV-0379'),
    (380, '2025-12-29 00:00:00+00'::timestamptz, 'PINV-0380'),
    (381, '2025-12-29 00:00:00+00'::timestamptz, 'PINV-0381'),
    (382, '2025-12-29 00:00:00+00'::timestamptz, 'PINV-0382'),
    (383, '2025-12-29 00:00:00+00'::timestamptz, 'PINV-0383'),
    (384, '2026-01-05 00:00:00+00'::timestamptz, 'PINV-0384'),
    (385, '2026-01-05 00:00:00+00'::timestamptz, 'PINV-0385'),
    (386, '2026-01-06 00:00:00+00'::timestamptz, 'PINV-0386'),
    (387, '2026-01-06 00:00:00+00'::timestamptz, 'PINV-0387'),
    (388, '2026-01-07 00:00:00+00'::timestamptz, 'PINV-0388'),
    (389, '2026-01-07 00:00:00+00'::timestamptz, 'PINV-0389'),
    (390, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0390'),
    (391, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0391'),
    (392, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0392'),
    (393, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0393'),
    (394, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0394'),
    (395, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0395'),
    (396, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0396'),
    (397, '2026-01-08 00:00:00+00'::timestamptz, 'PINV-0397'),
    (398, '2026-01-09 00:00:00+00'::timestamptz, 'PINV-0398'),
    (399, '2026-01-09 00:00:00+00'::timestamptz, 'PINV-0399'),
    (400, '2026-01-09 00:00:00+00'::timestamptz, 'PINV-0400'),
    (401, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0401'),
    (402, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0402'),
    (403, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0403'),
    (404, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0404'),
    (405, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0405'),
    (406, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0406'),
    (407, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0407'),
    (408, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0408'),
    (409, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0409'),
    (410, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0410'),
    (411, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0411'),
    (412, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0412'),
    (413, '2026-01-12 00:00:00+00'::timestamptz, 'PINV-0413'),
    (414, '2026-01-13 00:00:00+00'::timestamptz, 'PINV-0414'),
    (415, '2026-01-13 00:00:00+00'::timestamptz, 'PINV-0415'),
    (416, '2026-01-13 00:00:00+00'::timestamptz, 'PINV-0416'),
    (417, '2026-01-13 00:00:00+00'::timestamptz, 'PINV-0417'),
    (418, '2026-01-13 00:00:00+00'::timestamptz, 'PINV-0418'),
    (419, '2026-01-13 00:00:00+00'::timestamptz, 'PINV-0419'),
    (420, '2026-01-13 00:00:00+00'::timestamptz, 'PINV-0420'),
    (421, '2026-01-14 00:00:00+00'::timestamptz, 'PINV-0421'),
    (422, '2026-01-14 00:00:00+00'::timestamptz, 'PINV-0422'),
    (423, '2026-01-14 00:00:00+00'::timestamptz, 'PINV-0423'),
    (424, '2026-01-14 00:00:00+00'::timestamptz, 'PINV-0424'),
    (425, '2026-01-14 00:00:00+00'::timestamptz, 'PINV-0425'),
    (426, '2026-01-14 00:00:00+00'::timestamptz, 'PINV-0426')
),
db_sales AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM public.sales
  WHERE customer_name = 'Old System'
)
UPDATE public.sales s
SET created_at = c.new_date,
    invoice_no = c.new_invoice
FROM db_sales d
JOIN csv_data c ON d.row_num = c.row_num
WHERE s.id = d.id;

-- 3. Update corresponding journal entries to match the sale dates
UPDATE public.journal_entries j
SET created_at = s.created_at
FROM public.sales s
WHERE j.sale_id = s.id AND s.customer_name = 'Old System';

-- 4. Re-number existing post-import sales (e.g. old inv 720 and 721) to start sequentially from INV-001
WITH new_sales AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as seq_num
  FROM public.sales
  WHERE customer_name != 'Old System'
)
UPDATE public.sales s
SET invoice_no = 'INV-' || pg_catalog.lpad(d.seq_num::text, 3, '0')
FROM new_sales d
WHERE s.id = d.id;

-- 5. Upgrade the public.record_sale_transaction function to support p_created_at and p_invoice_no
CREATE OR REPLACE FUNCTION public.record_sale_transaction(
  p_customer_id integer,
  p_customer_name text, 
  p_total_amount numeric,
  p_amount_paid numeric, 
  p_payment_method text, 
  p_payment_status text,
  p_items jsonb,
  p_recorded_by text,
  p_tax_percentage numeric DEFAULT 0,
  p_tax_inclusive boolean DEFAULT TRUE,
  p_credit_used numeric DEFAULT 0,
  p_created_at timestamptz DEFAULT NULL,
  p_invoice_no text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  v_sale_id UUID;
  v_tax_amount NUMERIC := 0;
  v_net_amount NUMERIC := 0;
  v_total_with_tax NUMERIC;
  v_item RECORD;
BEGIN
  -- Auto-generate INV-xxx sequence number if not provided (manual sales)
  IF p_invoice_no IS NULL THEN
    DECLARE
      v_max_seq INTEGER;
    BEGIN
      SELECT COALESCE(MAX(pg_catalog.substring(invoice_no, 5)::integer), 0)
      INTO v_max_seq
      FROM public.sales
      WHERE invoice_no LIKE 'INV-%';
      
      p_invoice_no := 'INV-' || pg_catalog.lpad((v_max_seq + 1)::text, 3, '0');
    END;
  END IF;

  -- Tax Calculation
  IF p_tax_inclusive THEN
    v_net_amount := ROUND(p_total_amount / (1 + (p_tax_percentage / 100)), 1);
    v_tax_amount := ROUND(p_total_amount - v_net_amount, 1);
    v_total_with_tax := ROUND(p_total_amount, 1);
  ELSE
    v_tax_amount := ROUND(p_total_amount * (p_tax_percentage / 100), 1);
    v_net_amount := ROUND(p_total_amount, 1);
    v_total_with_tax := ROUND(p_total_amount + v_tax_amount, 1);
  END IF;

  -- Insert Sale Record (with custom created_at and invoice_no support)
  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    tax_percentage, tax_inclusive, tax_amount, created_at, invoice_no
  )
  VALUES (
    p_customer_id, p_customer_name, 
    v_total_with_tax, 
    ROUND(p_amount_paid + p_credit_used, 1),
    ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 1),
    p_payment_status, p_payment_method, p_recorded_by,
    p_tax_percentage, p_tax_inclusive, v_tax_amount,
    COALESCE(p_created_at, pg_catalog.now()),
    p_invoice_no
  ) RETURNING id INTO v_sale_id;

  -- Process Items
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, ROUND(v_item.subtotal, 1));
    
    UPDATE public.products SET stock_quantity = stock_quantity - v_item.quantity WHERE id = v_item.product_id;
  END LOOP;

  -- Journaling (with custom created_at support)
  INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at) 
  VALUES (v_sale_id, 'REVENUE', v_net_amount, 'Revenue from Sale #' || v_sale_id, COALESCE(p_created_at, pg_catalog.now()));
  
  IF v_tax_amount > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at) 
    VALUES (v_sale_id, 'TAX_PAYABLE', v_tax_amount, 'Tax collected', COALESCE(p_created_at, pg_catalog.now()));
  END IF;
  
  IF p_amount_paid > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at) 
    VALUES (v_sale_id, pg_catalog.upper(p_payment_method), ROUND(p_amount_paid, 1), 'Payment received', COALESCE(p_created_at, pg_catalog.now()));
  END IF;

  IF p_credit_used > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at) 
    VALUES (v_sale_id, 'CUSTOMER_DEPOSIT', ROUND(p_credit_used, 1), 'Applied from customer credit', COALESCE(p_created_at, pg_catalog.now()));
  END IF;
  
  IF (v_total_with_tax - (p_amount_paid + p_credit_used)) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at) 
    VALUES (v_sale_id, 'ACCOUNTS_RECEIVABLE', ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 1), 'Debt recorded', COALESCE(p_created_at, pg_catalog.now()));
  END IF;

  RETURN v_sale_id;
END;
$function$;

-- Explicit API grants for secure defaults compatibility
GRANT EXECUTE ON FUNCTION public.record_sale_transaction(
  integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text
) TO anon, authenticated, service_role;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
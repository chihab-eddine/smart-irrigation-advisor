-- ============================================
-- Smart Irrigation Advisor — Seed Data
-- Run this AFTER schema.sql
-- ============================================

-- ============================================
-- Moroccan Regions
-- ============================================
INSERT INTO public.moroccan_regions (name_fr, name_ar, latitude, longitude, climate_zone) VALUES
    ('Marrakech', 'مراكش', 31.6295, -7.9811, 'semi-arid'),
    ('Fès', 'فاس', 34.0181, -5.0078, 'semi-arid'),
    ('Casablanca', 'الدار البيضاء', 33.5731, -7.5898, 'mediterranean'),
    ('Agadir', 'أكادير', 30.4278, -9.5981, 'semi-arid'),
    ('Meknès', 'مكناس', 33.8935, -5.5547, 'semi-arid'),
    ('Oujda', 'وجدة', 34.6867, -1.9114, 'steppe'),
    ('Beni Mellal', 'بني ملال', 32.3373, -6.3498, 'semi-arid'),
    ('Errachidia', 'الرشيدية', 31.9314, -4.4288, 'arid'),
    ('Souss-Massa', 'سوس ماسة', 30.3500, -9.2500, 'semi-arid'),
    ('Draa-Tafilalet', 'درعة تافيلالت', 31.5000, -5.5000, 'arid'),
    ('Tanger', 'طنجة', 35.7595, -5.8340, 'mediterranean'),
    ('Rabat', 'الرباط', 34.0209, -6.8416, 'mediterranean');

-- ============================================
-- Crops (with FAO-56 Kc coefficients)
-- ============================================
INSERT INTO public.crops (name_fr, name_ar, kc_initial, kc_mid, kc_late, growth_duration_days, category) VALUES
    ('Blé', 'قمح', 0.30, 1.15, 0.40, 120, 'céréales'),
    ('Maïs', 'ذرة', 0.30, 1.20, 0.60, 130, 'céréales'),
    ('Tomate', 'طماطم', 0.60, 1.15, 0.80, 140, 'légumes'),
    ('Olivier', 'زيتون', 0.65, 0.70, 0.70, 365, 'arboriculture'),
    ('Agrumes', 'حوامض', 0.70, 0.65, 0.65, 365, 'arboriculture'),
    ('Pomme de terre', 'بطاطس', 0.50, 1.15, 0.75, 100, 'légumes'),
    ('Luzerne', 'فصة', 0.40, 0.95, 0.90, 365, 'fourrage'),
    ('Betterave sucrière', 'شمندر سكري', 0.35, 1.20, 0.70, 180, 'industriel'),
    ('Oignon', 'بصل', 0.70, 1.05, 0.75, 110, 'légumes'),
    ('Haricot', 'فاصوليا', 0.40, 1.15, 0.35, 90, 'légumes');

-- ============================================
-- Soil Types
-- ============================================
INSERT INTO public.soil_types (name_fr, name_ar, field_capacity, wilting_point, infiltration_rate) VALUES
    ('Argileux', 'تربة طينية', 0.40, 0.20, 5.0),
    ('Sableux', 'تربة رملية', 0.15, 0.05, 50.0),
    ('Limoneux', 'تربة طميية', 0.35, 0.15, 15.0),
    ('Argilo-sableux', 'تربة طينية رملية', 0.30, 0.12, 20.0),
    ('Limon argileux', 'طمي طيني', 0.38, 0.18, 8.0);

-- ============================================
-- App Config (default settings)
-- ============================================
INSERT INTO public.app_config (key, value, category, description) VALUES
    ('site_name_fr', 'Smart Irrigation Advisor', 'branding', 'Nom du site en français'),
    ('site_name_ar', 'مستشار الري الذكي', 'branding', 'Nom du site en arabe'),
    ('site_description_fr', 'Plateforme intelligente d''aide à la décision agricole pour les agriculteurs marocains', 'branding', 'Description du site en français'),
    ('site_description_ar', 'منصة ذكية لدعم القرار الزراعي للمزارعين المغاربة', 'branding', 'Description du site en arabe'),
    ('contact_email', 'contact@smartirrigation.ma', 'contact', 'Email de contact principal'),
    ('maintenance_mode', 'false', 'system', 'Mode maintenance activé/désactivé'),
    ('max_upload_size_mb', '5', 'system', 'Taille maximale d''upload en MB'),
    ('default_locale', 'fr', 'system', 'Langue par défaut (fr ou ar)'),
    ('weather_cache_ttl_minutes', '60', 'system', 'Durée de cache météo en minutes'),
    ('enable_newsletter', 'true', 'features', 'Activer/désactiver la newsletter'),
    ('enable_disease_detection', 'true', 'features', 'Activer/désactiver la détection des maladies');

-- ============================================
-- Default Admin User (update with your Supabase user ID)
-- After creating your first account, run:
-- UPDATE public.users SET role = 'admin' WHERE email = 'your-admin-email@example.com';
-- ============================================

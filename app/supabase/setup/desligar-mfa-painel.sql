update public.product_settings set value = jsonb_build_object('requireMfa', false), updated_at = now() where key = 'admin.security';
select key, value from public.product_settings where key = 'admin.security';

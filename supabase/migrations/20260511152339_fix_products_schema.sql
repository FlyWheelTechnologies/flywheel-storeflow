-- Fix Products table schema to include item_code
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS item_code TEXT;

-- Update the product change trigger to be more robust
CREATE OR REPLACE FUNCTION public.trig_log_product_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_action('PRODUCT_CREATE', 'Added ' || NEW.name || COALESCE(' (Code: ' || NEW.item_code || ')', ''));
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.stock_quantity != NEW.stock_quantity) THEN
      PERFORM public.log_action('STOCK_ADJUST', 'Product ' || NEW.name || ' stock changed from ' || OLD.stock_quantity || ' to ' || NEW.stock_quantity);
    ELSE
      PERFORM public.log_action('PRODUCT_UPDATE', 'Modified ' || NEW.name);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.log_action('PRODUCT_DELETE', 'Removed ' || OLD.name);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

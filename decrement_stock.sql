CREATE OR REPLACE FUNCTION decrement_stock(p_id TEXT, delta_qty INT)
RETURNS void AS $$
BEGIN
  -- We subtract the quantity from stock and add to units_sold atomically
  UPDATE products
  SET stock = stock - delta_qty,
      units_sold = COALESCE(units_sold, 0) + delta_qty,
      updated_at = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

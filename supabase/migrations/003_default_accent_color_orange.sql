alter table shops alter column accent_color set default '#EA580C';
update shops set accent_color = '#EA580C' where accent_color = '#C9A227';

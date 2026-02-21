import chilliChickenImage from '../../assets/food/chilli-chicken.jpg';

const normalizeName = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const FALLBACKS: Record<string, string> = {
  chillichicken: chilliChickenImage,
  chillychicken: chilliChickenImage,
};

export const getMenuItemImage = (name: string, imageUrl?: string | null) => {
  if (imageUrl) return imageUrl;
  return FALLBACKS[normalizeName(name)] || '';
};


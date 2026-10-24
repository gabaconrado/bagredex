export const resolveItemDescription = (text, context) => {
  if (text === undefined) {
    return {short_description: null, description: null, description_source: null};
  }
  if (!text || typeof text !== 'object' || typeof text.shortDesc !== 'string' || !text.shortDesc.trim()) {
    throw new Error(`${context}: missing non-empty text shortDesc`);
  }
  if (text.desc !== undefined && text.desc !== null && typeof text.desc !== 'string') {
    throw new Error(`${context}: text desc must be a string when present`);
  }
  const shortDescription = text.shortDesc.trim();
  const fullDescription = typeof text.desc === 'string' ? text.desc.trim() : '';
  return {
    short_description: shortDescription,
    description: fullDescription || shortDescription,
    description_source: fullDescription ? 'desc' : 'shortDesc',
  };
};

export const stringToBoolean = (value: string | undefined): boolean => {
  if (value === 'false') return false
  if (value === '0') return false
  return !!value
}

export const stringToArray = (value: string) => {
  if (!value) return []
  return value.split(/\s*,\s*/)
}

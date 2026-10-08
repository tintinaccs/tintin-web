import { PARAGUAY_LOCATIONS } from './ubicaciones-paraguay.js?v=tintin-20260725-paraguay-locations-1-master-20261007-1';

const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const departments = new Map();
for (const group of PARAGUAY_LOCATIONS) for (const city of group.ciudades) {
  const name = key(city);
  departments.set(name, departments.has(name) && departments.get(name) !== group.departamento ? null : group.departamento);
}
for (const city of ['San Lorenzo', 'Fernando de la Mora Zona Norte', 'Fernando de la Mora Zona Sur']) departments.set(key(city), 'Central');

// La configuración explícita se conserva. Los registros antiguos sin
// departamento usan la geografía canónica; los nombres desconocidos mantienen
// su compatibilidad anterior, sin inventar tarifas ni modificar datos.
export function shippingDepartment(city, explicit) {
  return String(explicit ?? '').trim() || departments.get(key(city)) || 'Central';
}

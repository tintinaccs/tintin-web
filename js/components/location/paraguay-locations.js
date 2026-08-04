// TINTIN — Referencia geográfica de Paraguay (departamentos y ciudades).
//
// Esto es dato de geografía fija (la división político-administrativa oficial
// de Paraguay), no dato de negocio: por eso vive acá como constante del sitio
// en vez de vivir en Firestore. Lo que SÍ es dato de negocio — qué ciudades
// hacen delivery, a qué precio, y cuáles van por encomienda — sigue viviendo
// en settings/general (deliveryCities / encomiendaCities), cargado por Super
// Admin, tal como ya funcionaba antes de este archivo.
export const PARAGUAY_LOCATIONS = [
  { departamento: 'Asunción (Capital)', ciudades: ['Asunción'] },
  { departamento: 'Central', ciudades: [
    'Areguá', 'Capiatá', 'Fernando de la Mora', 'Guarambaré', 'Itá', 'Itauguá',
    'J. Augusto Saldívar', 'Lambaré', 'Limpio', 'Luque', 'Mariano Roque Alonso',
    'Ñemby', 'Nueva Italia', 'San Antonio', 'San Lorenzo Centro',
    'San Lorenzo Alrededores', 'Villa Elisa', 'Villeta', 'Ypacaraí', 'Ypané',
  ] },
  { departamento: 'Alto Paraná', ciudades: [
    'Ciudad del Este', 'Presidente Franco', 'Hernandarias', 'Minga Guazú',
    'Santa Rita', 'Dr. Juan León Mallorquín', 'San Alberto', 'Itakyry',
    "Juan E. O'Leary", 'Yguazú', 'Los Cedrales', 'Minga Porá', 'Mbaracayú',
    'San Cristóbal', 'Santa Rosa del Monday', 'Naranjal', 'Santa Fe del Paraná',
    'Tavapy', 'Iruña', 'Domingo Martínez de Irala', 'Raúl Peña', 'Ñacunday',
  ] },
  { departamento: 'Itapúa', ciudades: [
    'Encarnación', 'Cambyretá', 'Bella Vista', 'Capitán Meza', 'Capitán Miranda',
    'Carlos Antonio López', 'Carmen del Paraná', 'Coronel Bogado', 'Edelira',
    'Fram', 'General Artigas', 'General Delgado', 'Hohenau', 'Jesús',
    'José Leandro Oviedo', 'La Paz', 'María Auxiliadora', 'Mayor Otaño',
    'Natalio', 'Nueva Alborada', 'Obligado', 'San Cosme y Damián',
    'San Juan del Paraná', 'San Pedro del Paraná', 'San Rafael del Paraná',
    'Tomás Romero Pereira', 'Trinidad', 'Yatytay', 'Alto Verá', 'Pirapó',
  ] },
  { departamento: 'Caaguazú', ciudades: [
    'Coronel Oviedo', 'Caaguazú', 'Dr. J. Eulogio Estigarribia (Campo 9)',
    'Repatriación', 'San José de los Arroyos', 'Carayaó', 'Dr. Cecilio Báez',
    'Santa Rosa del Mbutuy', 'Dr. Juan Manuel Frutos', 'Nueva Londres',
    'San Joaquín', 'Yhú', 'R.I. 3 Corrales', 'Raúl Arsenio Oviedo',
    'José Domingo Ocampos', 'Mariscal López', 'La Pastora', '3 de Febrero',
    'Simón Bolívar', 'Vaquería', 'Tembiaporá', 'Nueva Toledo',
  ] },
  { departamento: 'San Pedro', ciudades: [
    'San Estanislao (Santaní)', 'Santa Rosa del Aguaray',
    'San Pedro de Ycuamandyyú', 'Choré', 'Guayaibí', 'Capiibary',
    'General Elizardo Aquino', 'Itacurubí del Rosario', 'Antequera', 'Lima',
    'Nueva Germania', 'San Pablo', 'Tacuatí', 'Unión', '25 de Diciembre',
    'Villa del Rosario', 'General Isidoro Resquín', 'Yataity del Norte',
    'Yrybucuá', 'Liberación', 'San Vicente Pancholo',
  ] },
  { departamento: 'Cordillera', ciudades: [
    'Caacupé', 'San Bernardino', 'Tobatí', 'Piribebuy', 'Eusebio Ayala',
    'Altos', 'Arroyos y Esteros', 'Atyrá', 'Caraguatay', 'Emboscada',
    'Isla Pucú', 'Itacurubí de la Cordillera', 'Juan de Mena', 'Loma Grande',
    'Mbocayaty del Yhaguy', 'Nueva Colombia', 'Primero de Marzo', 'Santa Elena',
    'Valenzuela', 'San José Obrero',
  ] },
  { departamento: 'Guairá', ciudades: [
    'Villarrica', 'Independencia', 'Borja', 'Capitán Mauricio José Troche',
    'Coronel Martínez', 'Félix Pérez Cardozo', 'General Eugenio Garay',
    'Itapé', 'Iturbe', 'José Fassardi', 'Mbocayaty', 'Natalicio Talavera',
    'Ñumí', 'Paso Yobái', 'San Salvador', 'Yataity', 'Dr. Bottrell', 'Tebicuary',
  ] },
  { departamento: 'Caazapá', ciudades: [
    'Caazapá', 'Abaí', 'Buena Vista', 'Dr. Moisés Bertoni',
    'General Higinio Morínigo', 'Maciel', 'San Juan Nepomuceno', 'Tavaí',
    'Yegros', 'Yuty',
  ] },
  { departamento: 'Misiones', ciudades: [
    'San Juan Bautista', 'San Ignacio', 'Ayolas', 'Santa Rosa', 'San Miguel',
    'San Patricio', 'Santa María', 'Santiago', 'Villa Florida', 'Yabebyry',
  ] },
  { departamento: 'Paraguarí', ciudades: [
    'Paraguarí', 'Carapeguá', 'Yaguarón', 'Quiindy', 'Ybycuí', 'Acahay',
    'Caapucú', 'Caballero', 'Escobar', 'La Colmena', 'Mbuyapey', 'Pirayú',
    'Quyquyhó', 'San Roque González de Santa Cruz', 'Sapucai', 'Tebicuarymí',
    'Ybytymí', 'María Antonia',
  ] },
  { departamento: 'Ñeembucú', ciudades: [
    'Pilar', 'Alberdi', 'Cerrito', 'Desmochados',
    'General José Eduvigis Díaz', 'Guazú Cuá', 'Humaitá', 'Isla Umbú',
    'Laureles', 'Mayor José J. Martínez', 'Paso de Patria',
    'San Juan Bautista de Ñeembucú', 'Tacuaras', 'Villa Franca', 'Villa Oliva',
    'Villalbín',
  ] },
  { departamento: 'Amambay', ciudades: [
    'Pedro Juan Caballero', 'Bella Vista Norte', 'Capitán Bado', 'Karapaí',
    'Zanja Pytã', 'Cerro Corá',
  ] },
  { departamento: 'Canindeyú', ciudades: [
    'Salto del Guairá', 'Curuguaty', 'Katueté', 'Nueva Esperanza',
    'Corpus Christi', 'Ygatimí', 'Itanará', 'Ypejhú',
    'Francisco Caballero Álvarez', 'La Paloma del Espíritu Santo', 'Yasy Cañy',
    'Ybyrarobaná', 'Yby Pytá', 'Maracaná',
  ] },
  { departamento: 'Presidente Hayes', ciudades: [
    'Villa Hayes', 'Benjamín Aceval', 'Nanawa', 'José Falcón', 'Puerto Pinasco',
    'Tte. Irala Fernández', 'Tte. Esteban Martínez', 'General Bruguez',
    'Campo Aceval',
  ] },
  { departamento: 'Boquerón', ciudades: [
    'Filadelfia', 'Loma Plata', 'Mariscal Estigarribia', 'Boquerón',
  ] },
  { departamento: 'Alto Paraguay', ciudades: [
    'Fuerte Olimpo', 'Bahía Negra', 'Carmelo Peralta', 'Puerto Casado (La Victoria)',
  ] },
  { departamento: 'Concepción', ciudades: [
    'Concepción', 'Horqueta', 'Yby Yaú', 'Belén', 'Loreto', 'San Carlos del Apa',
    'San Lázaro', 'Azotey', 'Sargento José Félix López (Puentesiño)',
    'Paso Barreto', 'San Alfredo', 'Arroyito',
  ] },
];

// Ciudades de Asunción y Central que FitoXpress cubre con delivery a
// domicilio, con la tarifa fija de su lista de cobertura. Es la ÚNICA fuente
// para decidir "delivery vs. encomienda" en la carga inicial — el resto de
// TODAS las ciudades del país (todas las de arriba, salvo estas) van por
// encomienda. Coincide con lo que un vendedor cargaría a mano en Envíos.
export const FITOXPRESS_DELIVERY_CITIES = [
  { name: 'San Lorenzo Centro', price: 15000 },
  { name: 'San Lorenzo Alrededores', price: 20000 },
  { name: 'Capiatá', price: 25000 },
  { name: 'Ñemby', price: 25000 },
  { name: 'Ypané', price: 30000 },
  { name: 'Fernando de la Mora', price: 20000 },
  { name: 'Luque', price: 30000 },
  { name: 'Asunción', price: 30000 },
  { name: 'Villa Elisa', price: 25000 },
  { name: 'Mariano Roque Alonso', price: 30000 },
  { name: 'J. Augusto Saldívar', price: 35000 },
  { name: 'San Antonio', price: 30000 },
  { name: 'Itá', price: 40000 },
  { name: 'Limpio', price: 40000 },
  { name: 'Itauguá', price: 35000 },
  { name: 'Areguá', price: 30000 },
  { name: 'Lambaré', price: 30000 },
  { name: 'Guarambaré', price: 40000 },
];

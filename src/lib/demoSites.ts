import { Site, Wave, RefreshType } from './types'

function site(
  i: number,
  name: string, address: string, city: string, state: string, country: string,
  lat: number, lng: number, wave: Wave, status: Site['status'] = 'pending',
  refreshType?: RefreshType
): Site {
  return {
    id: `demo_${i}`,
    name, address, city, state, country, lat, lng, wave, status, refreshType,
    dias: {},
    createdAt: new Date().toISOString(),
  }
}

export const DEMO_SITES: Site[] = [
  // ── North America ────────────────────────────────────────────────────────────
  site(1,  'NAM-NYC-HQ',       '1 World Trade Center',          'New York',      'NY',   'United States',  40.7127, -74.0134, 1, 'in_progress', 'SDWAN'),
  site(2,  'NAM-LAX-DC',       '1100 W Olympic Blvd',           'Los Angeles',   'CA',   'United States',  34.0522, -118.2437, 1, 'pending',     'COLOC'),
  site(3,  'NAM-CHI-OFC',      '233 S Wacker Dr',               'Chicago',       'IL',   'United States',  41.8781, -87.6298, 1, 'pending',     'SDWAN'),
  site(4,  'NAM-DAL-HUB',      '2200 Ross Ave',                 'Dallas',        'TX',   'United States',  32.7767, -96.7970, 2, 'pending',     'FIBER'),
  site(5,  'NAM-MIA-GW',       '1451 NW 107th Ave',             'Miami',         'FL',   'United States',  25.7617, -80.1918, 2, 'pending',     'LTE'),
  site(6,  'NAM-TOR-OFC',      '100 King St W',                 'Toronto',       'ON',   'Canada',         43.6532, -79.3832, 2, 'pending',     'SDWAN'),
  site(7,  'NAM-MEX-HQ',       'Av. Insurgentes Sur 3900',      'Mexico City',   'CDMX', 'Mexico',         19.4326, -99.1332, 1, 'in_progress', 'SAP'),
  site(8,  'NAM-GDL-DC',       'Av. Vallarta 3959',             'Guadalajara',   'JAL',  'Mexico',         20.6597, -103.3496, 3, 'pending',    'MPLS'),

  // ── Latin America ────────────────────────────────────────────────────────────
  site(9,  'SAM-SAO-HQ',       'Av. Paulista 1374',             'São Paulo',     'SP',   'Brazil',        -23.5613, -46.6558, 1, 'in_progress', 'SDWAN'),
  site(10, 'SAM-RIO-OFC',      'Av. Rio Branco 1',              'Rio de Janeiro','RJ',   'Brazil',        -22.9068, -43.1729, 1, 'pending',     'SAP'),
  site(11, 'SAM-BSB-DC',       'SAAN Quadra 1 Lote 6',         'Brasília',      'DF',   'Brazil',        -15.7801, -47.9292, 2, 'pending',     'COLOC'),
  site(12, 'SAM-BOG-HQ',       'Cra. 7 #71-21',                 'Bogotá',        'DC',   'Colombia',       4.7110, -74.0721, 2, 'pending',     'SDWAN'),
  site(13, 'SAM-MED-DC',       'Calle 10 #43E-31',              'Medellín',      'ANT',  'Colombia',       6.2442, -75.5812, 3, 'pending',     'FIBER'),
  site(14, 'SAM-SCL-HQ',       'Av. Apoquindo 4800',            'Santiago',      'RM',   'Chile',        -33.4369, -70.6343, 1, 'completed',   'SDWAN'),
  site(15, 'SAM-BUE-OFC',      'Av. Corrientes 348',            'Buenos Aires',  'BA',   'Argentina',    -34.6037, -58.3816, 2, 'pending',     'MPLS'),
  site(16, 'SAM-LIM-GW',       'Av. El Derby 254',              'Lima',          'LIM',  'Peru',         -12.0464, -77.0428, 3, 'pending',     'LTE'),

  // ── Europe ──────────────────────────────────────────────────────────────────
  site(17, 'EUR-PAR-HQ',       '8 Rue de Berri',                'Paris',         'IDF',  'France',         48.8736,   2.3046, 1, 'in_progress', 'SDWAN'),
  site(18, 'EUR-LYO-DC',       '14 Rue de la République',       'Lyon',          'ARA',  'France',         45.7640,   4.8357, 2, 'pending',     'COLOC'),
  site(19, 'EUR-FRA-HUB',      'Mainzer Landstr. 58',           'Frankfurt',     'HE',   'Germany',        50.1109,   8.6821, 1, 'in_progress', 'HYBRID'),
  site(20, 'EUR-MUC-OFC',      'Maximilianstr. 35',             'Munich',        'BY',   'Germany',        48.1351,  11.5820, 2, 'pending',     'SAP'),
  site(21, 'EUR-LON-HQ',       '1 Canada Square',               'London',        'ENG',  'United Kingdom', 51.5054,  -0.0235, 1, 'completed',   'SDWAN'),
  site(22, 'EUR-MAN-DC',       '1 Spinningfields',              'Manchester',    'ENG',  'United Kingdom', 53.4808,  -2.2426, 2, 'pending',     'FIBER'),
  site(23, 'EUR-MIL-OFC',      'Via Monte Napoleone 8',         'Milan',         'MI',   'Italy',          45.4654,   9.1859, 1, 'pending',     'VOIP'),
  site(24, 'EUR-ROM-GW',       'Via del Corso 1',               'Rome',          'RM',   'Italy',          41.8967,  12.4822, 3, 'pending',     'LTE'),
  site(25, 'EUR-MAD-HQ',       'Paseo de la Castellana 259',    'Madrid',        'MAD',  'Spain',          40.4530,  -3.6883, 2, 'pending',     'SDWAN'),
  site(26, 'EUR-BCN-DC',       'Av. Diagonal 640',              'Barcelona',     'CAT',  'Spain',          41.3979,   2.1728, 2, 'pending',     'WIFI'),
  site(27, 'EUR-AMS-HUB',      'Prins Bernhardplein 200',       'Amsterdam',     'NH',   'Netherlands',    52.3676,   4.9041, 1, 'in_progress', 'HYBRID'),
  site(28, 'EUR-WAR-OFC',      'ul. Marszałkowska 80',          'Warsaw',        'MZ',   'Poland',         52.2297,  21.0122, 3, 'pending',     'MPLS'),
  site(29, 'EUR-ZUR-DC',       'Bahnhofstrasse 69',             'Zurich',        'ZH',   'Switzerland',    47.3769,   8.5417, 2, 'pending',     'DIA_ONLY'),
  site(30, 'EUR-STO-GW',       'Sveavägen 44',                  'Stockholm',     'AB',   'Sweden',         59.3293,  18.0686, 3, 'pending',     'FIBER'),

  // ── Middle East & Africa ─────────────────────────────────────────────────────
  site(31, 'MEA-DXB-HQ',       'Sheikh Zayed Rd, DIFC',         'Dubai',         'DU',   'UAE',            25.2048,  55.2708, 1, 'in_progress', 'SDWAN'),
  site(32, 'MEA-ABU-DC',       'Corniche Rd, ADGM',             'Abu Dhabi',     'AZ',   'UAE',            24.4539,  54.3773, 2, 'pending',     'COLOC'),
  site(33, 'MEA-RUH-OFC',      'King Fahd Rd, Olaya',           'Riyadh',        'RR',   'Saudi Arabia',   24.7136,  46.6753, 2, 'pending',     'SAP'),
  site(34, 'MEA-JNB-HQ',       '135 Rivonia Rd, Sandton',       'Johannesburg',  'GP',   'South Africa',  -26.1076,  28.0567, 1, 'pending',     'SDWAN'),
  site(35, 'MEA-CPT-DC',       '1 Lower Long St',               'Cape Town',     'WC',   'South Africa',  -33.9249,  18.4241, 3, 'pending',     'FIBER'),
  site(36, 'MEA-NBO-GW',       'Upper Hill Rd',                 'Nairobi',       'NAI',  'Kenya',          -1.2921,  36.8219, 3, 'pending',     'LTE'),
  site(37, 'MEA-CAI-OFC',      '9 Corniche El Nil',             'Cairo',         'CAI',  'Egypt',          30.0444,  31.2357, 3, 'pending',     'MPLS'),
  site(38, 'MEA-LAG-HUB',      'Victoria Island, Adeola Odeku', 'Lagos',         'LA',   'Nigeria',         6.4281,   3.4219, 3, 'pending',     'LTE'),

  // ── Asia-Pacific ─────────────────────────────────────────────────────────────
  site(39, 'APJ-TYO-HQ',       '2-4-1 Marunouchi, Chiyoda',    'Tokyo',         'TKO',  'Japan',          35.6762, 139.6503, 1, 'in_progress', 'SDWAN'),
  site(40, 'APJ-OSA-DC',       '1-1 Namba, Chuo-ku',           'Osaka',         'OSA',  'Japan',          34.6937, 135.5023, 2, 'pending',     'COLOC'),
  site(41, 'APJ-SHA-HQ',       '1000 Lujiazui Ring Rd, Pudong', 'Shanghai',      'SH',   'China',          31.2304, 121.4737, 1, 'in_progress', 'SAP'),
  site(42, 'APJ-BEJ-DC',       'No.1 Financial St, Xicheng',   'Beijing',       'BJ',   'China',          39.9042, 116.4074, 2, 'pending',     'HYBRID'),
  site(43, 'APJ-SZX-FACTORY',  'Longhua District',              'Shenzhen',      'GD',   'China',          22.5431, 114.0579, 2, 'pending',     'WIFI'),
  site(44, 'APJ-SIN-HUB',      '1 Raffles Quay',                'Singapore',     '',     'Singapore',       1.2836, 103.8514, 1, 'completed',   'SDWAN'),
  site(45, 'APJ-HKG-DC',       '8 Finance St, Central',         'Hong Kong',     'HKG',  'Hong Kong',      22.2793, 114.1628, 2, 'pending',     'DIA_ONLY'),
  site(46, 'APJ-BOM-HQ',       'Nariman Point',                 'Mumbai',        'MH',   'India',          18.9252,  72.8244, 2, 'pending',     'SDWAN'),
  site(47, 'APJ-DEL-DC',       'Connaught Place',               'New Delhi',     'DL',   'India',          28.6315,  77.2167, 3, 'pending',     'FIBER'),
  site(48, 'APJ-BLR-HUB',      'MG Road, Bengaluru',            'Bengaluru',     'KA',   'India',          12.9716,  77.5946, 3, 'pending',     'SAP'),
  site(49, 'APJ-SYD-HQ',       '1 Macquarie Place',             'Sydney',        'NSW',  'Australia',     -33.8688, 151.2093, 1, 'in_progress', 'HYBRID'),
  site(50, 'APJ-MEL-DC',       '140 William St',                'Melbourne',     'VIC',  'Australia',     -37.8136, 144.9631, 2, 'pending',     'VOIP'),
  site(51, 'APJ-KUL-GW',       'Jalan Ampang, KLCC',            'Kuala Lumpur',  'KL',   'Malaysia',        3.1390, 101.6869, 3, 'pending',     'SDWAN'),
  site(52, 'APJ-SEO-OFC',      'Teheran-ro 152, Gangnam',       'Seoul',         'GG',   'South Korea',    37.5665, 126.9780, 2, 'pending',     'WIFI'),
]

// Script to import CSV data into SQLite database (dataset from iNaturalist)
// Usage: node import_csv_to_db.js <csv_file> <db_file>

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');
const path = require('path');

if (process.argv.length < 4) {
  console.error('Usage: node import_csv_to_db.js <csv_file> <db_file>');
  process.exit(1);
}

const csvFile = process.argv[2];
const dbFile = process.argv[3];

const db = new sqlite3.Database(dbFile);

// Table schema, must match CSV columns
const columns = [
  'id','uuid','observed_on_string','observed_on','time_observed_at','time_zone','user_id','user_login','user_name','created_at','updated_at','quality_grade','license','url','image_url','sound_url','tag_list','description','num_identification_agreements','num_identification_disagreements','captive_cultivated','oauth_application_id','place_guess','latitude','longitude','positional_accuracy','private_place_guess','private_latitude','private_longitude','public_positional_accuracy','geoprivacy','taxon_geoprivacy','coordinates_obscured','positioning_method','positioning_device','species_guess','scientific_name','common_name','iconic_taxon_name','taxon_id'
];

const createTableSQL = `CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  uuid TEXT,
  observed_on_string TEXT,
  observed_on TEXT,
  time_observed_at TEXT,
  time_zone TEXT,
  user_id INTEGER,
  user_login TEXT,
  user_name TEXT,
  created_at TEXT,
  updated_at TEXT,
  quality_grade TEXT,
  license TEXT,
  url TEXT,
  image_url TEXT,
  sound_url TEXT,
  tag_list TEXT,
  description TEXT,
  num_identification_agreements INTEGER,
  num_identification_disagreements INTEGER,
  captive_cultivated BOOLEAN,
  oauth_application_id INTEGER,
  place_guess TEXT,
  latitude REAL,
  longitude REAL,
  positional_accuracy INTEGER,
  private_place_guess TEXT,
  private_latitude REAL,
  private_longitude REAL,
  public_positional_accuracy INTEGER,
  geoprivacy TEXT,
  taxon_geoprivacy TEXT,
  coordinates_obscured BOOLEAN,
  positioning_method TEXT,
  positioning_device TEXT,
  species_guess TEXT,
  scientific_name TEXT,
  common_name TEXT,
  iconic_taxon_name TEXT,
  taxon_id INTEGER
);`;

db.serialize(() => {
  db.run(createTableSQL);

  // Read entire CSV file as text
  const csvText = fs.readFileSync(csvFile, 'utf8');
  // Split into records, handling quoted newlines
  const records = [];
  let record = '';
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') inQuotes = !inQuotes;
    if (char === '\n' && !inQuotes) {
      records.push(record);
      record = '';
    } else {
      record += char;
    }
  }
  if (record) records.push(record);

  // Custom CSV line splitter: handles quoted fields, commas, and empty fields
  function splitCSVLine(line) {
    const result = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        // Check for escaped quote
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    result.push(field); // last field
    return result.map(v => v.replace(/^"|"$/g, ''));
  }

  let isHeader = true;
  for (const line of records) {
    // Skip header
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line.trim()) continue; // Skip empty lines
    const values = splitCSVLine(line);
    // Only insert if values length matches columns length
    if (values.length !== columns.length) continue;
    const placeholders = columns.map(() => '?').join(',');
    db.run(`INSERT INTO observations (${columns.join(',')}) VALUES (${placeholders})`, values);
  }
  console.log('CSV import completed.');
  db.close();
});

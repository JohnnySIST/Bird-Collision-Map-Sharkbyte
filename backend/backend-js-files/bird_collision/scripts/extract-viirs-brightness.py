"""
VIIRS HDF5 Brightness Extraction Script
Downloads VIIRS HDF5 files and extracts brightness values for collision locations
"""

import os
import sys
import requests
import h5py
import numpy as np
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# NASA Token
NASA_TOKEN = "eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6ImJpcmRzZmx5aW5nIiwiZXhwIjoxNzY3ODMxOTE0LCJpYXQiOjE3NjI2NDc5MTQsImlzcyI6Imh0dHBzOi8vdXJzLmVhcnRoZGF0YS5uYXNhLmdvdiIsImlkZW50aXR5X3Byb3ZpZGVyIjoiZWRsX29wcyIsImFjciI6ImVkbCIsImFzc3VyYW5jZV9sZXZlbCI6M30.TDfr_HoOiXrTJz3Q1FlkyfDAjH-jGMl2hTIeHva8DCi4UDT-S0xNgwNvgk0pL1baTG08e5FYn0a6QkE6T7JrfRE-K1PSg6xauLZHeLYpjPj__Qzp3V0jAKp2gnCBIQYqyjrOltlSm8-IiyhjCi888NswIspQ7uG3_lgWSKc-82rIbV5WXAz7IIZ7bLyJc8nmyK9HfkP4wJCIS9qamhi3E306GcyZUI1doTw-9QNMxXey_-0ijGPZEJ0QYvDVRtO0HKTKJ6tzitVYouNJ4x8UoEv5_ErOlqFGoiiZB2t48bCPhQUL3V8IsWd-pW2ebUZAuIECy7Z66In1Tl14ikcM7Q"

# Database connection (from .env.local)
DATABASE_URL = "postgresql://postgres:birdsalwaysfly7@db.ojartwvwhwdubrhuzwdu.supabase.co:5432/postgres"

# Directory for temporary HDF5 downloads
DOWNLOAD_DIR = "./viirs_downloads"

def setup_download_dir():
    """Create directory for HDF5 downloads"""
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)
        print(f"✓ Created download directory: {DOWNLOAD_DIR}")

def get_db_connection():
    """Connect to Supabase database"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        sys.exit(1)

def download_hdf5_file(url, filename):
    """Download HDF5 file from NASA"""
    filepath = os.path.join(DOWNLOAD_DIR, filename)
    
    # Skip if already downloaded
    if os.path.exists(filepath):
        print(f"  ✓ File already exists: {filename}")
        return filepath
    
    try:
        print(f"  Downloading {filename}...")
        headers = {'Authorization': f'Bearer {NASA_TOKEN}'}
        
        response = requests.get(url, headers=headers, stream=True, timeout=300)
        response.raise_for_status()
        
        # Download in chunks
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"  ✓ Downloaded: {filename} ({os.path.getsize(filepath) / 1024 / 1024:.2f} MB)")
        return filepath
    
    except Exception as e:
        print(f"  ✗ Download failed: {e}")
        return None

def lat_lon_to_pixel(lat, lon, h_tile, v_tile):
    """
    Convert lat/lon to pixel coordinates in VIIRS tile
    VIIRS uses sinusoidal projection
    """
    # VIIRS tile parameters
    TILE_SIZE = 2400  # pixels per tile
    EARTH_RADIUS = 6371007.181  # meters
    
    # Tile origin (upper left corner)
    tile_lon_min = (h_tile * 10) - 180
    tile_lat_max = 90 - (v_tile * 10)
    
    # Sinusoidal projection
    x = EARTH_RADIUS * np.radians(lon - tile_lon_min) * np.cos(np.radians(lat))
    y = EARTH_RADIUS * np.radians(tile_lat_max - lat)
    
    # Convert to pixel coordinates
    pixel_x = int(x / (10 * EARTH_RADIUS * 2 * np.pi / 360 / TILE_SIZE))
    pixel_y = int(y / (10 * EARTH_RADIUS * 2 * np.pi / 360 / TILE_SIZE))
    
    # Clamp to tile bounds
    pixel_x = max(0, min(TILE_SIZE - 1, pixel_x))
    pixel_y = max(0, min(TILE_SIZE - 1, pixel_y))
    
    return pixel_x, pixel_y

def extract_brightness_from_hdf5(filepath, lat, lon, h_tile, v_tile):
    """
    Extract brightness value from HDF5 file for specific coordinates
    """
    try:
        with h5py.File(filepath, 'r') as hdf:
            # VIIRS Black Marble products have different dataset names
            # Try common dataset names
            brightness_datasets = [
                'HDFEOS/GRIDS/VNP_Grid_DNB/Data Fields/DNB_BRDF-Corrected_NTL',
                'DNB_At_Sensor_Radiance_500m',
                'Gap_Filled_DNB_BRDF-Corrected_NTL'
            ]
            
            brightness_data = None
            for dataset_name in brightness_datasets:
                if dataset_name in hdf:
                    brightness_data = hdf[dataset_name][:]
                    break
            
            if brightness_data is None:
                # List available datasets
                print(f"  Available datasets in file:")
                def print_structure(name, obj):
                    print(f"    - {name}")
                hdf.visititems(print_structure)
                return None, "Dataset not found"
            
            # Get pixel coordinates
            pixel_x, pixel_y = lat_lon_to_pixel(lat, lon, h_tile, v_tile)
            
            # Extract brightness value
            brightness = float(brightness_data[pixel_y, pixel_x])
            
            # Handle fill values (usually 65535 or -999)
            if brightness > 10000 or brightness < 0:
                return None, "Fill value"
            
            print(f"  ✓ Extracted brightness: {brightness:.2f} nW/cm²/sr")
            return brightness, "success"
    
    except Exception as e:
        print(f"  ✗ HDF5 extraction error: {e}")
        return None, str(e)

def process_viirs_records():
    """
    Main processing function
    Fetches VIIRS records without brightness values and processes them
    """
    print("\n=== VIIRS Brightness Extraction ===\n")
    
    setup_download_dir()
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Fetch records needing brightness extraction
    print("Fetching VIIRS records without brightness values...")
    cursor.execute("""
        SELECT id, collision_id, latitude, longitude, date, 
               tile_h, tile_v, metadata
        FROM viirs_nightlights
        WHERE brightness_avg IS NULL
        AND metadata->>'download_url' IS NOT NULL
        ORDER BY date DESC
        LIMIT 20
    """)
    
    records = cursor.fetchall()
    print(f"Found {len(records)} records to process\n")
    
    if len(records) == 0:
        print("No records need processing!")
        return
    
    processed = 0
    success = 0
    errors = 0
    
    for record in records:
        try:
            print(f"\n[{processed + 1}/{len(records)}] Processing record {record['id']}")
            print(f"  Collision ID: {record['collision_id']}")
            print(f"  Location: ({record['latitude']:.4f}, {record['longitude']:.4f})")
            print(f"  Date: {record['date']}")
            print(f"  Tile: h{record['tile_h']}v{record['tile_v']}")
            
            # Get download URL from metadata
            metadata = record['metadata']
            download_url = metadata.get('download_url')
            
            if not download_url:
                print("  ✗ No download URL in metadata")
                errors += 1
                processed += 1
                continue
            
            # Generate filename from URL
            filename = download_url.split('/')[-1]
            
            # Download HDF5 file
            filepath = download_hdf5_file(download_url, filename)
            
            if not filepath:
                errors += 1
                processed += 1
                continue
            
            # Extract brightness
            brightness, status = extract_brightness_from_hdf5(
                filepath,
                float(record['latitude']),
                float(record['longitude']),
                record['tile_h'],
                record['tile_v']
            )
            
            if brightness is not None:
                # Update database
                cursor.execute("""
                    UPDATE viirs_nightlights
                    SET brightness_avg = %s,
                        brightness_quality = %s
                    WHERE id = %s
                """, (brightness, status, record['id']))
                conn.commit()
                
                print(f"  ✓ Updated database with brightness value")
                success += 1
            else:
                # Update status even if extraction failed
                cursor.execute("""
                    UPDATE viirs_nightlights
                    SET brightness_quality = %s
                    WHERE id = %s
                """, (status, record['id']))
                conn.commit()
                
                print(f"  - Could not extract brightness: {status}")
                errors += 1
            
            processed += 1
            
        except Exception as e:
            print(f"  ✗ Processing error: {e}")
            errors += 1
            processed += 1
            conn.rollback()
    
    cursor.close()
    conn.close()
    
    print(f"\n\n=== Processing Complete ===")
    print(f"Total processed: {processed}")
    print(f"Successfully extracted: {success}")
    print(f"Errors: {errors}")
    print(f"\nDownloaded files are in: {DOWNLOAD_DIR}")
    print(f"You can delete them after processing to save space.")

if __name__ == "__main__":
    print("VIIRS Brightness Extraction")
    print("===========================")
    print("\nThis script will:")
    print("1. Fetch VIIRS records without brightness values")
    print("2. Download HDF5 files from NASA")
    print("3. Extract brightness for each collision location")
    print("4. Update database with radiance values\n")
    
    try:
        process_viirs_records()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n✗ Fatal error: {e}")
        sys.exit(1)

import openpyxl
import json
# The specific import for ArrayFormula has been removed.

def excel_range_to_json(excel_path, sheet_name, cell_range, json_path):
    """
    Converts a specific range from an Excel sheet to a JSON object,
    using cell coordinates as keys and preserving all formulas.
    This version is compatible with older openpyxl libraries.
    """
    try:
        workbook = openpyxl.load_workbook(excel_path, data_only=False)
        sheet = workbook[sheet_name]
        cell_data = {}

        for row in sheet[cell_range]:
            for cell in row:
                key = cell.coordinate
                value = cell.value

                # --- FIX for older openpyxl versions ---
                # Check the object's type by its name as a string
                if type(value).__name__ == 'ArrayFormula':
                    # Convert the formula object to a simple string
                    value = f"={str(value)}"

                cell_data[key] = value

        with open(json_path, 'w') as f:
            json.dump(cell_data, f, indent=2)
        
        print(f"✅ Success! Converted range '{cell_range}' from '{sheet_name}' to '{json_path}'")

    except Exception as e:
        print(f"❌ Error: {e}")
        
# --- CONFIGURATION ---
# 1. Your Excel file name
excel_file = '1BidSheet.xlsx' 
# 2. The name of the sheet
sheet_to_convert = 'Quote Sheet'
# 3. The specific range you want to convert (e.g., 'A1:D4')
data_range = 'A1:U182'
# 4. The desired output file name
json_file = 'ConvertedBidSheet.json'

# --- RUN THE CONVERSION ---
excel_range_to_json(excel_file, sheet_to_convert, data_range, json_file)
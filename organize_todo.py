
import os
import re
import sys
from collections import defaultdict

STANDARD_HEADERS = [
    'Context', 'Intent', 'Directive', 'Module', 'Class/Object', 
    'Function/Method', 'Input', 'Output', 'Decision Logic', 
    'Next Step Recommendation', 'Updated Date'
]

def clean_cell(cell):
    return cell.strip()

def parse_row(line):
    # Split by | but handle escaped pipes if any (simplified for now assuming no escaped pipes in simple markdown table)
    parts = line.split('|')
    # Remove first and last empty parts if they exist (standard markdown table)
    if len(parts) > 0 and parts[0].strip() == '':
        parts = parts[1:]
    if len(parts) > 0 and parts[-1].strip() == '':
        parts = parts[:-1]
    return [clean_cell(p) for p in parts]

def main():
    repo_root = os.path.abspath(os.path.dirname(__file__))
    file_path = os.path.join(repo_root, 'todo-log.md')
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    preamble = []
    rows = []
    
    current_headers = None
    in_preamble = True
    
    # Simple state machine
    # We want to capture the preamble (everything before the first data-containing grouping or table)
    # Actually, the file starts with # todo-log, etc.
    # The first ## DATE line starts the sections.
    # So we keep everything until the first `## ` line.
    
    preamble_lines = []
    content_lines = lines
    
    # Find the index of the first `## ` line
    first_h2_index = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('## '):
            first_h2_index = i
            break
            
    if first_h2_index != -1:
        preamble = lines[:first_h2_index]
        content_to_process = lines[first_h2_index:]
    else:
        print("No H2 found!")
        # Fallback: maybe the first line after some point?
        # Let's assume preamble ends after line 4 based on known structure
        preamble = lines[:4] 
        content_to_process = lines[4:]

    print(f"Preamble lines: {len(preamble)}")
    print(f"Content lines to process: {len(content_to_process)}")


    # Process content to find tables
    # We iterate line by line.
    # If we find a line starting with `|`, it might be a header or row.
    
    iterator = iter(content_to_process)
    current_col_map = None # Maps standard header name to index in current row
    
    for line in iterator:
        stripped = line.strip()
        if not stripped.startswith('|'):
            continue
            
        # Check if it is a separator line
        if set(stripped) <= set('|- \t'):
            continue
            
        # Check if it is a header line
        # Heuristic: Contains "Context" and "Intent"
        cells = parse_row(line)
        if 'Context' in cells and 'Intent' in cells:
            # It's a header
            current_col_map = {}
            for idx, h in enumerate(cells):
                current_col_map[h] = idx
            continue
            
        # It's a data row
        if current_col_map:
            row_data = {}
            # Initialize with '-'
            for h in STANDARD_HEADERS:
                row_data[h] = '-'
            
            # Fill available data
            for header, idx in current_col_map.items():
                if idx < len(cells):
                    val = cells[idx]
                    # Map to standard header if possible
                    # We assume header names in file match standard headers or subset
                    if header in STANDARD_HEADERS:
                        row_data[header] = val
            
            # Check if we have Updated Date
            if row_data['Updated Date'] == '-' or row_data['Updated Date'] == '':
                 # Try to find date in the line if parsing failed? 
                 # Or maybe the column name was different?
                 # In the file, it's always "Updated Date".
                 pass
            
            rows.append(row_data)

    print(f"Found {len(rows)} rows.")

    # Group by Updated Date
    grouped = defaultdict(list)
    for row in rows:
        raw_date = row['Updated Date']
        # normalize date: take first part if space exists (YYYY-MM-DD HH:MM -> YYYY-MM-DD)
        if not raw_date or raw_date == '-':
            date_key = 'Unknown'
        else:
            date_key = raw_date.split(' ')[0]
            
        grouped[date_key].append(row)
        
    # Sort dates
    # Filter out 'Unknown' to put at end or beginning
    dates = [d for d in grouped.keys() if d != 'Unknown']
    dates.sort(reverse=True) # Newest first
    
    print(f"Dates found: {dates}")

    if 'Unknown' in grouped:
        dates.append('Unknown')
        
    # Construct output
    output_lines = []
    output_lines.extend(preamble)
    
    # Standard Header Line
    header_line = '| ' + ' | '.join(STANDARD_HEADERS) + ' |'
    # Standard Separator
    # We need to match the length roughly or just use standard `---`
    # The user file uses `|--------|` etc. I'll just use `---` for simplicity or try to match.
    # I'll use simple `---`.
    separator_line = '| ' + ' | '.join(['---'] * len(STANDARD_HEADERS)) + ' |'
    
    for date in dates:
        # Add H2
        # Ensure spacing
        if output_lines and output_lines[-1].strip() != '':
            output_lines.append('\n')
            
        output_lines.append(f"## {date}\n")
        output_lines.append('\n')
        
        output_lines.append(header_line + '\n')
        output_lines.append(separator_line + '\n')
        
        date_rows = grouped[date]
        # Sort rows? Maybe by module or something? User didn't specify. 
        # But preserving relative order is usually good.
        # But since we aggregated from multiple places, relative order is mixed.
        # I'll just keep them as they came (stable sort relative to file order).
        
        for row in date_rows:
            # Construct row line
            vals = [row[h] for h in STANDARD_HEADERS]
            line_str = '| ' + ' | '.join(vals) + ' |'
            output_lines.append(line_str + '\n')
            
    # Write back
    print(f"Writing {len(output_lines)} lines to {file_path}")
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(output_lines)
        print("Write successful")
    except Exception as e:
        print(f"Write failed: {e}")

if __name__ == '__main__':
    main()

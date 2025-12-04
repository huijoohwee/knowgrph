import Papa from 'papaparse';

/**
 * Process uploaded CSV file and trigger pipeline regeneration
 */
export async function processCSVUpload(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            throw new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
          }

          if (!results.data || results.data.length === 0) {
            throw new Error('CSV file is empty or invalid');
          }

          // Validate required A0 schema columns
          const requiredColumns = [
            'graph_id', 'domain', 'category', 'entity_type', 
            'subject', 'predicate', 'object'
          ];
          
          const headers = Object.keys(results.data[0] as any);
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          
          if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
          }

          // Convert to JSON-LD format
          const jsonldData = convertCSVToJSONLD(results.data as any[]);
          
          // Simulate pipeline processing
          await simulatePipelineProcessing(jsonldData);
          
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      }
    });
  });
}

/**
 * Convert CSV data to JSON-LD format
 */
function convertCSVToJSONLD(csvData: any[]): any {
  const context = {
    "@vocab": "https://huijoohwee.github.io/schema/vocab.jsonld",
    "id": "@id",
    "type": "@type"
  };

  const graph = csvData.map((row, index) => {
    const node: any = {
      "id": row.graph_id || `custom:${index}`,
      "type": row.entity_type || "Component",
      "subject": row.subject,
      "predicate": row.predicate,
      "object": row.object
    };

    // Add optional fields if they exist and have values
    const optionalFields = [
      'domain', 'category', 'stage', 'attribute', 'value',
      'role', 'action', 'outcome', 'challenge', 'solution',
      'context', 'source_location', 'source_type', 'component_name',
      'operation_name', 'operation_description', 'temporal_marker',
      'impact_description', 'source_reference', 'metadata_json'
    ];

    optionalFields.forEach(field => {
      if (row[field] && row[field].trim() !== '') {
        node[field] = row[field];
      }
    });

    return node;
  });

  return {
    "@context": context,
    "@graph": graph
  };
}

/**
 * Simulate pipeline processing (client-side)
 */
async function simulatePipelineProcessing(jsonldData: any): Promise<void> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    // Store in localStorage for the visualization to pick up
    localStorage.setItem('custom_pipeline_data', JSON.stringify(jsonldData));
    
    // Log for debugging
    console.log('Pipeline processing completed:', {
      nodes: jsonldData['@graph'].length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    throw new Error(`Pipeline processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load custom pipeline data from localStorage
 */
export function loadCustomPipelineData(): any | null {
  try {
    const data = localStorage.getItem('custom_pipeline_data');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load custom pipeline data:', error);
    return null;
  }
}

/**
 * Clear custom pipeline data
 */
export function clearCustomPipelineData(): void {
  localStorage.removeItem('custom_pipeline_data');
}
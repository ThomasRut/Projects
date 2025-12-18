import React, { useState } from 'react';
import { Upload, Download, Copy, Loader2, AlertCircle, Settings } from 'lucide-react';

// Price table matching Excel
const PRICE_TABLE = {
  'A': { '10000+': 0.0121, '5000+': 0.0129, '2000+': 0.0137, '1000+': 0.0144, min: 18.00, max: 160.00 },
  'B': { '10000+': 0.0132, '5000+': 0.0140, '2000+': 0.0147, '1000+': 0.0157, min: 20.00, max: 180.00 },
  'C': { '10000+': 0.0143, '5000+': 0.0150, '2000+': 0.0160, '1000+': 0.0169, min: 22.00, max: 200.00 },
  'D': { '10000+': 0.0154, '5000+': 0.0163, '2000+': 0.0173, '1000+': 0.0183, min: 24.00, max: 220.00 },
  'E': { '10000+': 0.0183, '5000+': 0.0195, '2000+': 0.0204, '1000+': 0.0218, min: 26.00, max: 240.00 },
  'F': { '10000+': 0.0198, '5000+': 0.0209, '2000+': 0.0221, '1000+': 0.0235, min: 28.00, max: 260.00 },
  'G': { '10000+': 0.0213, '5000+': 0.0226, '2000+': 0.0239, '1000+': 0.0253, min: 31.00, max: 290.00 },
  'H': { '10000+': 0.0230, '5000+': 0.0243, '2000+': 0.0258, '1000+': 0.0273, min: 34.00, max: 320.00 },
  'I': { '10000+': 0.0249, '5000+': 0.0262, '2000+': 0.0279, '1000+': 0.0295, min: 37.00, max: 350.00 },
  'J': { '10000+': 0.0267, '5000+': 0.0284, '2000+': 0.0301, '1000+': 0.0319, min: 40.00, max: 380.00 },
  'K': { '10000+': 0.0289, '5000+': 0.0307, '2000+': 0.0325, '1000+': 0.0344, min: 43.00, max: 400.00 },
  'L': { '10000+': 0.0313, '5000+': 0.0332, '2000+': 0.0352, '1000+': 0.0371, min: 46.00, max: 420.00 },
};

function App() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fuelSurchargePercent, setFuelSurchargePercent] = useState(0.24);
  const [showSettings, setShowSettings] = useState(false);

  // Calculate chargeable weight
  const calculateChargeableWeight = (volumeFt3) => {
    if (!volumeFt3) return 0;
    return (volumeFt3 * 1728) / 115;
  };

  // Calculate freight
  const calculateFreight = (zone, applicableWeight) => {
    const zoneRates = PRICE_TABLE[zone?.toUpperCase()];
    if (!zoneRates) {
      console.warn(`⚠️ Zone "${zone}" not found in price table. Valid zones: A-L`);
      return 'Quote Required';
    }
    
    let rate;
    if (applicableWeight >= 10000) rate = zoneRates['10000+'];
    else if (applicableWeight >= 5000) rate = zoneRates['5000+'];
    else if (applicableWeight >= 2000) rate = zoneRates['2000+'];
    else if (applicableWeight >= 1000) rate = zoneRates['1000+'];
    else rate = zoneRates['1000+']; // Use 1000+ rate for under 1000 lbs
    
    const calculated = rate * applicableWeight;
    const result = Math.max(calculated, zoneRates.min);
    return Math.min(result, zoneRates.max);
  };

  // Calculate fuel surcharge
  const calculateFuelSurcharge = (freight) => {
    if (freight === 'Quote Required') return 'Quote Required';
    return freight * fuelSurchargePercent;
  };

  // Calculate inside delivery charge - Image 2: $10 min or 0.004 per LB, $80 max
  const calculateInsideDelivery = (isRequired, applicableWeight) => {
    if (!isRequired || isRequired === "") return 0;
    const calculated = applicableWeight * 0.004;
    return Math.min(Math.max(calculated, 10), 80);
  };

  // Calculate over length charge - Image 2: expects INCHES ranges as strings
  const calculateOverLength = (overLengthRange) => {
    if (!overLengthRange || overLengthRange === "") return 0;
    
    // Parse inch ranges - Claude now returns these as strings
    if (overLengthRange === "97-144") return 12;
    if (overLengthRange === "145-192") return 18;
    if (overLengthRange === "193-240") return 24;
    if (overLengthRange === "241 or more") return 30;
    
    return 0;
  };

  // Calculate time-specific - Image 3: Time windows (updated format)
  const calculateTimeSpecific = (timeType, zone) => {
    if (!timeType) return 0;
    const isEarlyZone = ['A', 'B', 'C', 'D'].includes(zone?.toUpperCase());
    
    // Image 3 rates - updated to match new format
    if (timeType === 'AM Special') return isEarlyZone ? 28 : 38;
    if (timeType === '2 Hours') return isEarlyZone ? 38 : 48;
    if (timeType === '15 Minutes') return isEarlyZone ? 53 : 63;
    
    return 0;
  };

  // Calculate detention - Image 3: $36 per hour, first 30 mins free
  const calculateDetention = (minutes) => {
    if (!minutes || minutes <= 30) return 0;
    const billableMinutes = minutes - 30;
    return (billableMinutes / 60) * 36;
  };

  // Calculate debris removal - Image 2: $3 per pallet if section exists OR if Lakeshore
  const calculateDebrisRemoval = (palletCount, hasDebrisSection, isLakeshore) => {
    if (!palletCount) return 0;
    if (hasDebrisSection || isLakeshore) {
      return palletCount * 3;
    }
    return 0;
  };

  // Process PDFs with Claude API
  const processPDFs = async () => {
    if (files.length === 0) {
      setError('Please upload at least one BOL PDF');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const processedResults = [];

      for (const file of files) {
        const driverName = file.name.replace('.pdf', '').replace(/_/g, ' ');

        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch('http://localhost:3001/api/process-bol', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64, filename: file.name }),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to process BOL');

        const failedPages = [];

        for (const pageResult of data.results) {
          try {
            if (!pageResult.success) {
              failedPages.push({ pageNumber: pageResult.pageNumber, error: pageResult.error, filename: file.name });
              continue;
            }

            const textContent = pageResult.data;
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
              failedPages.push({ pageNumber: pageResult.pageNumber, error: 'Could not parse response', filename: file.name });
              continue;
            }

            const extracted = JSON.parse(jsonMatch[0]);

            // Calculate charges
            const chargeableWeight = calculateChargeableWeight(extracted.volume);
            const applicableWeight = Math.max(extracted.weight || 0, chargeableWeight);
            
            const freight = calculateFreight(extracted.zone, applicableWeight);
            const fuelSurcharge = calculateFuelSurcharge(freight);
            
            // Image 2: Debris removal logic
            const debrisRemoval = calculateDebrisRemoval(
              extracted.palletCount, 
              extracted.hasDebrisSection,
              extracted.isLakeshore
            );
            
            // Updated to use string values directly from Claude
            const liftgate = extracted.liftgate === "Yes" ? 20 : 0;
            const inside = calculateInsideDelivery(extracted.inside, applicableWeight);
            const overLength = calculateOverLength(extracted.overLength);
            const residential = extracted.residential === "Yes" ? 15 : 0;
            const timeSpecific = calculateTimeSpecific(extracted.timeSpecific, extracted.zone);
            const detention = calculateDetention(extracted.detention);
            const extras = 0; // Placeholder for manual extras
            
            let total = freight === 'Quote Required' ? 'Quote Required' :
              freight + fuelSurcharge + debrisRemoval + liftgate + inside + 
              (overLength === 'Quote' ? 0 : overLength) + residential + timeSpecific + detention + extras;

            processedResults.push({
              pro: extracted.pro,
              driver: driverName,
              zone: extracted.zone || '?',
              weight: extracted.weight || 0,
              volumeFt3: extracted.volume || 0,
              chargeable: applicableWeight.toFixed(2),
              freight: freight === 'Quote Required' ? freight : `${freight.toFixed(2)}`,
              fuelSurcharge: fuelSurcharge === 'Quote Required' ? fuelSurcharge : `${fuelSurcharge.toFixed(2)}`,
              debrisRemoval: `${debrisRemoval.toFixed(2)}`,
              liftgate: extracted.liftgate, // Now returns "Yes" or ""
              inside: extracted.inside, // Now returns "Yes" or ""
              overLength: extracted.overLength, // Now returns range string or ""
              residential: extracted.residential, // Now returns "Yes" or ""
              timeSpecific: extracted.timeSpecific, // Now returns "AM Special", "2 Hours", "15 Minutes", or ""
              detention: extracted.detention || 0, // Number of minutes
              extras: `${extras.toFixed(2)}`,
              total: total === 'Quote Required' ? total : `${total.toFixed(2)}`,
            });

          } catch (error) {
            failedPages.push({ pageNumber: pageResult.pageNumber, error: error.message, filename: file.name });
          }
        }

        if (failedPages.length > 0) {
          const failureMessage = failedPages.map(f => `Page ${f.pageNumber}: ${f.error}`).join('\n');
          setError(prev => prev ? `${prev}\n\n⚠️ ${failedPages.length} page(s) failed in ${file.name}:\n${failureMessage}` : 
            `⚠️ ${failedPages.length} page(s) failed in ${file.name}:\n${failureMessage}`);
        }
      }

      setResults(processedResults);

    } catch (err) {
      setError(`Error processing PDFs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const headers = [
      'Job', 'Driver', 'ZONE', 'Weight', 'Volume-ft3', 'Chargeable',
      'Freight', 'Fuel Sur.', 'Debris R', 'Liftgate', 'Inside', 
      'Over Length', 'Residential', 'Time Specific', 'Detention', 'Extras', 'Total'
    ];
    const rows = results.map(r => [
      r.pro, r.driver, r.zone, r.weight, r.volumeFt3, r.chargeable,
      r.freight, r.fuelSurcharge, r.debrisRemoval, r.liftgate, r.inside,
      r.overLength, r.residential, r.timeSpecific, r.detention > 0 ? `${r.detention} min` : '', r.extras, r.total
    ]);
    
    const table = [headers, ...rows].map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(table);
    alert('Table copied! Paste into Excel.');
  };

  const downloadCSV = () => {
    const headers = [
      'Job', 'Driver', 'ZONE', 'Weight', 'Volume-ft3', 'Chargeable',
      'Freight', 'Fuel Sur.', 'Debris R', 'Liftgate', 'Inside', 
      'Over Length', 'Residential', 'Time Specific', 'Detention', 'Extras', 'Total'
    ];
    const rows = results.map(r => [
      r.pro, r.driver, r.zone, r.weight, r.volumeFt3, r.chargeable,
      r.freight, r.fuelSurcharge, r.debrisRemoval, r.liftgate, r.inside,
      r.overLength, r.residential, r.timeSpecific, r.detention > 0 ? `${r.detention} min` : '', r.extras, r.total
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bol-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">BOL Data Extractor</h1>
              <p className="text-gray-600 mt-1">Upload BOL PDFs to extract data and calculate charges</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Fuel Surcharge</p>
                <p className="text-2xl font-bold text-blue-600">{(fuelSurchargePercent * 100).toFixed(0)}%</p>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">Settings</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Fuel Surcharge %:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={fuelSurchargePercent * 100}
                    onChange={(e) => setFuelSurchargePercent(parseFloat(e.target.value) / 100)}
                    className="w-20 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <button
                  onClick={() => setFuelSurchargePercent(0.24)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Reset to 24%
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">Upload BOL PDFs</p>
              <p className="text-sm text-gray-500">Click to select multiple PDF files</p>
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) => setFiles(Array.from(e.target.files))}
                className="hidden"
              />
            </div>
          </label>

          {files.length > 0 && (
            <div className="mt-4">
              <p className="font-medium text-gray-700 mb-2">Selected Files ({files.length}):</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {files.map((file, i) => (
                  <div key={i} className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                    {file.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={processPDFs}
            disabled={loading || files.length === 0}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Extract & Calculate'
            )}
          </button>
        </div>

        {error && (
          <div className={`${results.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4 mb-6`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 ${results.length > 0 ? 'text-yellow-600' : 'text-red-600'} flex-shrink-0 mt-0.5`} />
              <p className={`whitespace-pre-line ${results.length > 0 ? 'text-yellow-800' : 'text-red-800'}`}>{error}</p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Results ({results.length} BOLs)</h2>
              <div className="flex gap-2">
                <button onClick={copyToClipboard} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                  <Copy className="w-4 h-4" /> Copy Table
                </button>
                <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-3 py-2 text-left">Job</th>
                    <th className="border px-3 py-2 text-left">Driver</th>
                    <th className="border px-3 py-2 text-left">Zone</th>
                    <th className="border px-3 py-2 text-right">Weight</th>
                    <th className="border px-3 py-2 text-right">Volume</th>
                    <th className="border px-3 py-2 text-right">Chargeable</th>
                    <th className="border px-3 py-2 text-right">Freight</th>
                    <th className="border px-3 py-2 text-right">Fuel</th>
                    <th className="border px-3 py-2 text-right">Debris</th>
                    <th className="border px-3 py-2 text-center">Lift</th>
                    <th className="border px-3 py-2 text-center">Inside</th>
                    <th className="border px-3 py-2 text-center">Over</th>
                    <th className="border px-3 py-2 text-center">Res</th>
                    <th className="border px-3 py-2 text-center">Time</th>
                    <th className="border px-3 py-2 text-right">Det</th>
                    <th className="border px-3 py-2 text-right">Extras</th>
                    <th className="border px-3 py-2 text-right bg-blue-50 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{row.pro}</td>
                      <td className="border px-3 py-2">{row.driver}</td>
                      <td className="border px-3 py-2 text-center">{row.zone}</td>
                      <td className="border px-3 py-2 text-right">{row.weight}</td>
                      <td className="border px-3 py-2 text-right">{row.volumeFt3}</td>
                      <td className="border px-3 py-2 text-right">{row.chargeable}</td>
                      <td className="border px-3 py-2 text-right">{row.freight === 'Quote Required' ? row.freight : `$${row.freight}`}</td>
                      <td className="border px-3 py-2 text-right">{row.fuelSurcharge === 'Quote Required' ? row.fuelSurcharge : `$${row.fuelSurcharge}`}</td>
                      <td className="border px-3 py-2 text-right">${row.debrisRemoval}</td>
                      <td className="border px-3 py-2 text-center">{row.liftgate}</td>
                      <td className="border px-3 py-2 text-center">{row.inside}</td>
                      <td className="border px-3 py-2 text-center">{row.overLength}</td>
                      <td className="border px-3 py-2 text-center">{row.residential}</td>
                      <td className="border px-3 py-2 text-center">{row.timeSpecific}</td>
                      <td className="border px-3 py-2 text-right">{row.detention > 0 ? `${row.detention} min` : ''}</td>
                      <td className="border px-3 py-2 text-right">${row.extras}</td>
                      <td className="border px-3 py-2 text-right font-bold bg-blue-50">
                        {row.total === 'Quote Required' ? row.total : `$${row.total}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
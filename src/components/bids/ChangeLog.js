import React, { useState } from 'react';
import { ChangeLogIcon, ChevronDownIcon } from '../../Icons';

export default function ChangeLog({ log = [], hasLogAccess = false }) {
    const [expandedLogEntries, setExpandedLogEntries] = useState({});

    const toggleLogEntry = (index) => {
        setExpandedLogEntries(prev => ({ ...prev, [index]: !prev[index] }));
    };

    if (!hasLogAccess) {
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Change Log</h3>
                <p className="text-gray-500 text-sm">Access restricted</p>
            </div>
        );
    }

    return (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <ChangeLogIcon />
                <span className="ml-2">Change Log</span>
            </h2>
            {log.length === 0 ? (
                <p className="text-gray-500 text-sm">No changes recorded</p>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {log.slice().sort((a, b) => {
                        // Handle missing or invalid timestamps - support both old 'date' and new 'timestamp' formats
                        let aTime = 0;
                        let bTime = 0;
                        
                        if (a.timestamp?.toMillis) {
                            aTime = a.timestamp.toMillis();
                        } else if (a.date) {
                            aTime = new Date(a.date).getTime();
                        }
                        
                        if (b.timestamp?.toMillis) {
                            bTime = b.timestamp.toMillis();
                        } else if (b.date) {
                            bTime = new Date(b.date).getTime();
                        }
                        
                        return bTime - aTime;
                    }).map((entry, index) => {
                        const [summary, ...details] = entry.change.split('\n').filter(line => line.trim() !== '');
                        const hasDetails = details.length > 0;
                        const isExpanded = expandedLogEntries[index];

                        return (
                            <div key={index} className="p-3 bg-gray-50 rounded-md border-l-4 border-blue-400">
                                <div className={`flex justify-between items-center ${hasDetails ? 'cursor-pointer' : ''}`} onClick={hasDetails ? () => toggleLogEntry(index) : undefined}>
                                    <p className="text-sm font-semibold text-gray-800">{summary}</p>
                                    {hasDetails && (<ChevronDownIcon className={`h-5 w-5 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />)}
                                </div>
                                {hasDetails && isExpanded && (
                                    <ul className="mt-2 pl-5 list-disc text-sm text-gray-700 space-y-1">
                                        {details.map((detail, i) => (<li key={i}>{detail.substring(detail.startsWith('- ') ? 2 : 0)}</li>))}
                                    </ul>
                                )}
                                <p className="text-xs text-gray-500 mt-2 text-right">
                                    by <strong>{
                                        entry.user?.name || 
                                        (typeof entry.user === 'string' ? entry.user : 'Unknown')
                                    }</strong> on {
                                        entry.timestamp?.toDate 
                                            ? entry.timestamp.toDate().toLocaleString()
                                            : entry.date 
                                            ? new Date(entry.date).toLocaleString()
                                            : 'Unknown date'
                                    }
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

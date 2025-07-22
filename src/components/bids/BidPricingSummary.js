import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

const configPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/config`;

export default function BidPricingSummary({ bid, laborBreakdown, totalMaterialCost, userData, db }) {
    const [markups, setMarkups] = useState({ laborBurden: 0, salesTax: 0, overhead: 0.08, profit: 0.10 });
    const isSupervisor = userData?.role === 'supervisor';
    
    // Load markups from database
    useEffect(() => {
        if (!db) return;
        const markupDocRef = doc(db, configPath, 'markup');
        const unsubscribe = onSnapshot(markupDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMarkups({
                    laborBurden: parseFloat(data.laborBurden) || 0,
                    salesTax: parseFloat(data.salesTax) || 0,
                    overhead: parseFloat(data.overhead) || 0.08,
                    profit: parseFloat(data.profit) || 0.10
                });
            }
        });
        return unsubscribe;
    }, [db]);
    
    const calculateTotalHardCost = () => {
        const materialCost = totalMaterialCost || 0;
        const baseLaborCost = (laborBreakdown.hanging?.labor || 0) + (laborBreakdown.taping?.labor || 0);
        const laborWithBurden = baseLaborCost * (1 + markups.laborBurden);
        return materialCost + laborWithBurden;
    };

    const hardCost = calculateTotalHardCost();
    const overhead = hardCost * markups.overhead;
    const profit = hardCost * markups.profit;
    const subtotal = hardCost + overhead + profit;
    const salesTax = subtotal * markups.salesTax;
    const netQuote = Math.ceil((subtotal + salesTax) / 5) * 5; // Round to nearest $5

    if (isSupervisor) {
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Pricing Summary</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Hang Labor:</span>
                        <span>${laborBreakdown.hanging?.labor?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Tape Labor:</span>
                        <span>${laborBreakdown.taping?.labor?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                        <span>Net Quote:</span>
                        <span>${netQuote.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Pricing Breakdown</h3>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span>Total Material:</span>
                    <span>${totalMaterialCost?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Hang Labor:</span>
                    <span>${laborBreakdown.hanging?.labor?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Tape Labor:</span>
                    <span>${laborBreakdown.taping?.labor?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                    <span>Total Hard Cost:</span>
                    <span>${hardCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Overhead (8%):</span>
                    <span>${overhead.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Profit (10%):</span>
                    <span>${profit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Net Quote:</span>
                    <span>${netQuote.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}
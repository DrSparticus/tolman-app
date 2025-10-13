export function TaperCrew(area, finishes) {
    if (!area || !finishes || !finishes.wallTextures || !finishes.ceilingTextures || !finishes.corners) {
        return 0;
    }
    let total = 0;
    
    //logic here
    return total;
}

export function getTaperRate(hangRate, bid, finishes, materials, crewTypes) {
    // If no hang rate provided, return 0
    if (!hangRate) return 0;
    
    const baseHangRate = parseFloat(hangRate) || 0;
    const baseAddition = 0.04;
    
    // Calculate sum of pay rates for selected finishes that involve taper crew
    let taperFinishesTotal = 0;
    
    // Find taper crew ID
    const taperCrewId = crewTypes?.find(crew => crew.name.toLowerCase().includes('tap'))?.id;
    
    if (bid && finishes && taperCrewId) {
        // Check wall texture
        if (bid.wallTexture && finishes.wallTextures) {
            const wallTexture = finishes.wallTextures.find(f => f.name === bid.wallTexture);
            if (wallTexture && wallTexture.crew === taperCrewId) {
                taperFinishesTotal += parseFloat(wallTexture.pay) || 0;
            }
        }
        
        // Check ceiling texture
        if (bid.ceilingTexture && finishes.ceilingTextures) {
            const ceilingTexture = finishes.ceilingTextures.find(f => f.name === bid.ceilingTexture);
            if (ceilingTexture && ceilingTexture.crew === taperCrewId) {
                taperFinishesTotal += parseFloat(ceilingTexture.pay) || 0;
            }
        }
        
        // Check corners
        if (bid.corners && finishes.corners) {
            const corners = finishes.corners.find(f => f.name === bid.corners);
            if (corners && corners.crew === taperCrewId) {
                taperFinishesTotal += parseFloat(corners.pay) || 0;
            }
        }
    }
    
    // Add extra taper pay from materials used in bid
    let materialExtraPay = 0;
    if (bid && bid.areas && materials && taperCrewId) {
        bid.areas.forEach(area => {
            if (area.materials) {
                area.materials.forEach(areaMat => {
                    const material = materials.find(m => m.id === areaMat.materialId);
                    if (material && material.extraLabor) {
                        const taperExtra = material.extraLabor.find(extra => extra.crewType === taperCrewId);
                        if (taperExtra) {
                            materialExtraPay += parseFloat(taperExtra.extraPay) || 0;
                        }
                    }
                });
            }
        });
    }
    
    return parseFloat((baseHangRate + baseAddition + taperFinishesTotal + materialExtraPay).toFixed(3));
}
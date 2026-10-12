"use strict";

// Important Rules Checker
class ImportantRulesChecker {
    constructor() {
        this.importantRules = [];
        this.colorImportantRules = [];
        this.init();
    }

    init() {
        console.log('🔍 === IMPORTANT RULES CHECKER ===');
        this.checkAllImportantRules();
        this.checkColorImportantRules();
        this.generateReport();
    }

    checkAllImportantRules() {
        console.log('\n⚠️ Checking all !important rules...');
        
        try {
            const stylesheets = Array.from(document.styleSheets);
            stylesheets.forEach((sheet, index) => {
                try {
                    if (sheet.cssRules) {
                        for (let rule of sheet.cssRules) {
                            if (rule.style && rule.style.cssText.includes('!important')) {
                                const importantProperties = this.extractImportantProperties(rule.style.cssText);
                                
                                this.importantRules.push({
                                    stylesheet: index,
                                    href: sheet.href || 'inline',
                                    selector: rule.selectorText,
                                    properties: importantProperties,
                                    fullRule: rule.style.cssText
                                });
                                
                                console.log(`⚠️ !important rule found:`);
                                console.log(`   Stylesheet: ${sheet.href || 'inline'}`);
                                console.log(`   Selector: ${rule.selectorText}`);
                                console.log(`   Properties: ${importantProperties.join(', ')}`);
                            }
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Cannot access stylesheet ${index}: ${e.message}`);
                }
            });
        } catch (error) {
            console.log('⚠️ Error checking stylesheets:', error);
        }
    }

    checkColorImportantRules() {
        console.log('\n🎨 Checking color-related !important rules...');
        
        const colorProperties = [
            'color', 'background', 'background-color', 'border', 'border-color',
            'box-shadow', 'text-shadow', 'outline', 'outline-color'
        ];
        
        this.importantRules.forEach(rule => {
            const hasColorProperty = rule.properties.some(prop => 
                colorProperties.some(colorProp => prop.includes(colorProp))
            );
            
            if (hasColorProperty) {
                this.colorImportantRules.push(rule);
                console.log(`🎨 Color !important rule found:`);
                console.log(`   Selector: ${rule.selector}`);
                console.log(`   Color Properties: ${rule.properties.filter(prop => 
                    colorProperties.some(colorProp => prop.includes(colorProp))
                ).join(', ')}`);
            }
        });
    }

    extractImportantProperties(cssText) {
        const properties = [];
        const lines = cssText.split(';');
        
        lines.forEach(line => {
            if (line.includes('!important')) {
                const property = line.trim();
                if (property) {
                    properties.push(property);
                }
            }
        });
        
        return properties;
    }

    generateReport() {
        console.log('\n📊 === IMPORTANT RULES REPORT ===');
        
        console.log(`\n📈 Total !important rules found: ${this.importantRules.length}`);
        console.log(`🎨 Color-related !important rules: ${this.colorImportantRules.length}`);
        
        if (this.importantRules.length > 0) {
            console.log('\n⚠️ All !important rules:');
            this.importantRules.forEach((rule, index) => {
                console.log(`${index + 1}. ${rule.selector}`);
                console.log(`   Properties: ${rule.properties.join(', ')}`);
                console.log(`   Source: ${rule.href}`);
            });
        }
        
        if (this.colorImportantRules.length > 0) {
            console.log('\n🎨 Color !important rules (may affect themes):');
            this.colorImportantRules.forEach((rule, index) => {
                console.log(`${index + 1}. ${rule.selector}`);
                console.log(`   Color Properties: ${rule.properties.filter(prop => 
                    ['color', 'background', 'border', 'box-shadow', 'text-shadow'].some(colorProp => 
                        prop.includes(colorProp)
                    )
                ).join(', ')}`);
                console.log(`   Source: ${rule.href}`);
            });
        }
        
        console.log('\n💡 Recommendations:');
        if (this.colorImportantRules.length > 0) {
            console.log('1. Remove !important from color-related properties');
            console.log('2. Use CSS specificity instead of !important');
            console.log('3. Check if !important rules override theme colors');
        } else {
            console.log('1. No color-related !important rules found');
            console.log('2. Theme colors should not be overridden by !important');
        }
        
        if (this.importantRules.length > 0) {
            console.log('3. Consider removing unnecessary !important rules');
            console.log('4. Use CSS custom properties for dynamic styling');
        }
    }
}

// Auto-run important rules checker
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new ImportantRulesChecker();
        }, 1000);
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ImportantRulesChecker = ImportantRulesChecker;
    window.checkImportantRules = () => new ImportantRulesChecker();
}

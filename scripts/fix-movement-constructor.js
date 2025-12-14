#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Movement Constructor Fix Script
 * 
 * Bu script şu hataları düzeltir:
 * 1. "Movement" import'larını "Aptos" yapar (@aptos-labs/ts-sdk'dan)
 * 2. "new Aptos(" kullanımlarını "new Aptos(" yapar
 * 3. "movement" değişken isimlerini "aptos" yapar (sadece constructor'dan sonra)
 */

// Dosya uzantıları ve dizinler
const INCLUDE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const EXCLUDE_DIRS = ['node_modules', '.git', '.next', 'build', 'dist'];

// Düzeltme kuralları
const FIX_REPLACEMENTS = [
  // Import'larda Movement -> Aptos
  {
    pattern: /import\s*{\s*([^}]*?)Movement([^}]*?)}\s*from\s*['"]@aptos-labs\/ts-sdk['"]/g,
    replacement: (match, before, after) => {
      const beforeClean = before.replace(/,\s*$/, '');
      const afterClean = after.replace(/^\s*,/, '');
      const beforePart = beforeClean ? beforeClean + ', ' : '';
      const afterPart = afterClean ? ', ' + afterClean : '';
      return `import { ${beforePart}Aptos${afterPart} } from '@aptos-labs/ts-sdk'`;
    },
    description: 'Movement import\'larını Aptos yapar'
  },
  
  // Constructor kullanımları
  {
    pattern: /new Movement\(/g,
    replacement: 'new Aptos(',
    description: 'new Aptos( kullanımlarını new Aptos( yapar'
  }
];

// Özel durumlar - bu dosyalarda değişiklik yapılmayacak
const SKIP_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

class MovementConstructorFixer {
  constructor() {
    this.processedFiles = 0;
    this.changedFiles = 0;
    this.totalChanges = 0;
    this.errors = [];
  }

  /**
   * Dosyanın işlenip işlenmeyeceğini kontrol eder
   */
  shouldProcessFile(filePath) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);
    
    // Skip dosyalarını kontrol et
    if (SKIP_FILES.includes(fileName)) {
      return false;
    }
    
    // Uzantı kontrolü
    if (!INCLUDE_EXTENSIONS.includes(ext)) {
      return false;
    }
    
    // Dizin kontrolü
    const relativePath = path.relative(process.cwd(), filePath);
    for (const excludeDir of EXCLUDE_DIRS) {
      if (relativePath.includes(excludeDir)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Dosya içeriğini işler
   */
  processFileContent(content, filePath) {
    let newContent = content;
    let fileChanges = 0;
    
    // Import düzeltmeleri
    const importMatches = newContent.match(/import\s*{\s*([^}]*?)Movement([^}]*?)}\s*from\s*['"]@aptos-labs\/ts-sdk['"]/g);
    if (importMatches) {
      for (const match of importMatches) {
        const replacement = match.replace(/Movement/g, 'Aptos');
        newContent = newContent.replace(match, replacement);
        fileChanges++;
        console.log(`  ✓ Import düzeltmesi: Movement -> Aptos`);
      }
    }
    
    // Constructor düzeltmeleri
    const constructorMatches = newContent.match(/new Movement\(/g);
    if (constructorMatches) {
      newContent = newContent.replace(/new Movement\(/g, 'new Aptos(');
      fileChanges += constructorMatches.length;
      console.log(`  ✓ Constructor düzeltmesi: ${constructorMatches.length} adet new Aptos( -> new Aptos(`);
    }
    
    return { content: newContent, changes: fileChanges };
  }

  /**
   * Tek bir dosyayı işler
   */
  async processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const result = this.processFileContent(content, filePath);
      
      this.processedFiles++;
      
      if (result.changes > 0) {
        fs.writeFileSync(filePath, result.content, 'utf8');
        this.changedFiles++;
        this.totalChanges += result.changes;
        
        console.log(`🔧 ${path.relative(process.cwd(), filePath)} (${result.changes} düzeltme)`);
      }
      
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      console.error(`❌ Hata: ${filePath} - ${error.message}`);
    }
  }

  /**
   * Dizini recursive olarak tarar
   */
  async scanDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Hariç tutulan dizinleri atla
        if (!EXCLUDE_DIRS.includes(item)) {
          await this.scanDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        if (this.shouldProcessFile(fullPath)) {
          await this.processFile(fullPath);
        }
      }
    }
  }

  /**
   * Ana çalıştırma fonksiyonu
   */
  async run() {
    console.log('🔧 Movement Constructor Fix Script Başlatılıyor...\n');
    
    const startTime = Date.now();
    
    try {
      await this.scanDirectory(process.cwd());
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log('\n✅ Constructor Düzeltmesi Tamamlandı!');
      console.log(`📊 Özet:`);
      console.log(`  • İşlenen dosya sayısı: ${this.processedFiles}`);
      console.log(`  • Düzeltilen dosya sayısı: ${this.changedFiles}`);
      console.log(`  • Toplam düzeltme sayısı: ${this.totalChanges}`);
      console.log(`  • Süre: ${duration} saniye`);
      
      if (this.errors.length > 0) {
        console.log(`\n⚠️  Hatalar (${this.errors.length}):`);
        this.errors.forEach(error => {
          console.log(`  • ${error.file}: ${error.error}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Kritik hata:', error.message);
      process.exit(1);
    }
  }
}

// Script'i çalıştır
if (require.main === module) {
  const fixer = new MovementConstructorFixer();
  fixer.run().catch(console.error);
}

module.exports = MovementConstructorFixer;
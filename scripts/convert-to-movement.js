#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Movement Conversion Script
 * 
 * Bu script şu değişiklikleri yapar:
 * 1. MOVE, MOVE, MOVE birimlerini MOVE yapar
 * 2. "Movement" yazılarını "Movement" yapar
 * 3. APT-Casino yazıları değişmez (APT-Casino olarak kalır)
 */

// Dosya uzantıları ve dizinler
const INCLUDE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.sh', '.bat', '.toml'];
const EXCLUDE_DIRS = ['node_modules', '.git', '.next', 'build', 'dist'];

// Değişiklik kuralları
const REPLACEMENTS = [
  // Birim değişiklikleri - APT-Casino hariç
  {
    pattern: /\b(?<!MOVE-)(?:MOVE|MOVE|MOVE)\b/g,
    replacement: 'MOVE',
    description: 'MOVE, MOVE, MOVE birimlerini MOVE yapar (APT-Casino hariç)'
  },
  
  // Movement -> Movement değişiklikleri
  {
    pattern: /\bAptos\b/g,
    replacement: 'Movement',
    description: 'Movement kelimesini Movement yapar'
  },
  
  // movement -> movement (küçük harf)
  {
    pattern: /\baptos\b/g,
    replacement: 'movement',
    description: 'movement kelimesini movement yapar'
  },
  
  // APT Casino -> APT Casino (sadece başlıklarda)
  {
    pattern: /APT Casino/g,
    replacement: 'APT Casino',
    description: 'APT Casino başlıklarını APT Casino yapar'
  }
];

// Özel durumlar - bu dosyalarda değişiklik yapılmayacak
const SKIP_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

class MovementConverter {
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
    
    for (const rule of REPLACEMENTS) {
      const matches = newContent.match(rule.pattern);
      if (matches) {
        newContent = newContent.replace(rule.pattern, rule.replacement);
        fileChanges += matches.length;
        console.log(`  ✓ ${rule.description}: ${matches.length} değişiklik`);
      }
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
        
        console.log(`📝 ${path.relative(process.cwd(), filePath)} (${result.changes} değişiklik)`);
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
    console.log('🚀 Movement Conversion Script Başlatılıyor...\n');
    
    console.log('📋 Değişiklik Kuralları:');
    REPLACEMENTS.forEach((rule, index) => {
      console.log(`  ${index + 1}. ${rule.description}`);
    });
    console.log('');
    
    const startTime = Date.now();
    
    try {
      await this.scanDirectory(process.cwd());
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log('\n✅ Conversion Tamamlandı!');
      console.log(`📊 Özet:`);
      console.log(`  • İşlenen dosya sayısı: ${this.processedFiles}`);
      console.log(`  • Değiştirilen dosya sayısı: ${this.changedFiles}`);
      console.log(`  • Toplam değişiklik sayısı: ${this.totalChanges}`);
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
  const converter = new MovementConverter();
  converter.run().catch(console.error);
}

module.exports = MovementConverter;
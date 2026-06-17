import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-document-pipeline',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './document-pipeline.component.html',
  styleUrl: './document-pipeline.component.css'
})
export class DocumentPipelineComponent implements OnInit {
  stats: any = { pending: 0, processing: 0, completed: 0, failed: 0 };
  queue: any[] = [];
  filteredQueue: any[] = [];
  searchTerm: string = '';
  statusFilter: string = 'All';
  selectedExtraction: any = null;
  isModalOpen = false;
  isPreviewModalOpen = false;
  previewUrl: SafeResourceUrl | null = null;
  previewFileType: string = '';
  isCompareModalOpen = false;
  compareDataLeft: any = {};
  compareDataRight: any = {};
  compareKeys: string[] = [];
  isEditModalOpen = false;
  editingItem: any = null;
  editFields: any = {};
  editFormKeys: string[] = [];
  loadingStats = true;
  loadingQueue = true;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.fetchStats();
    this.fetchQueue();
    // Auto refresh every 10 seconds
    setInterval(() => {
      this.fetchStats();
      this.fetchQueue();
    }, 10000);
  }

  fetchStats() {
    this.http.get('http://localhost:3000/api/document-pipeline/stats').subscribe({
      next: (data: any) => {
        this.stats = data;
        this.loadingStats = false;
      },
      error: (err) => {
        console.error('Error fetching stats', err);
        this.loadingStats = false;
      }
    });
  }

  fetchQueue() {
    this.http.get('http://localhost:3000/api/document-pipeline/queue').subscribe({
      next: (data: any) => {
        this.queue = data;
        this.applyFilters();
        this.loadingQueue = false;
      },
      error: (err) => {
        console.error('Error fetching queue', err);
        this.loadingQueue = false;
      }
    });
  }

  viewExtraction(item: any) {
    if (item.status !== 'completed') return;
    
    this.http.get(`http://localhost:3000/api/document-pipeline/queue/${item.id}/extraction`).subscribe({
      next: (data: any) => {
        console.log('extraction data:', data);
        this.selectedExtraction = data;
        this.isModalOpen = true;
      },
      error: (err) => {
        console.error('Error fetching extraction details', err);
        alert('Failed to load extraction details or no details found.');
      }
    });
  }

  downloadExtraction(item: any, event: Event) {
    event.stopPropagation();
    if (item.status !== 'completed') return;

    this.http.get(`http://localhost:3000/api/document-pipeline/queue/${item.id}/extraction`).subscribe({
      next: (data: any) => {
        const flatData = this.flattenObject(data.extracted_data || {});
        const csvContent = this.convertToCSV(flatData);
        this.downloadCSV(csvContent, `${item.file_name}_extraction.csv`);
      },
      error: (err) => {
        console.error('Error fetching extraction for download', err);
        alert('Failed to load extraction details for download.');
      }
    });
  }

  flattenObject(obj: any, prefix = ''): any {
    return Object.keys(obj).reduce((acc: any, k: string) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, this.flattenObject(obj[k], pre + k));
      } else if (Array.isArray(obj[k])) {
        acc[pre + k] = JSON.stringify(obj[k]);
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }

  convertToCSV(flatObj: any): string {
    const keys = Object.keys(flatObj);
    if (keys.length === 0) return '';
    
    const header = keys.map(k => this.escapeCSV(k)).join(',');
    const values = keys.map(k => this.escapeCSV(flatObj[k])).join(',');

    return `${header}\n${values}`;
  }

  escapeCSV(val: any): string {
    if (val === null || val === undefined) return '';
    const strVal = String(val);
    if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
      return `"${strVal.replace(/"/g, '""')}"`;
    }
    return strVal;
  }

  downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  previewDocument(item: any, event: Event) {
    event.stopPropagation();
    const url = `http://localhost:3000/api/document-pipeline/queue/${item.id}/file`;
    this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    
    this.previewFileType = item.file_type ? item.file_type.toLowerCase() : '';
    const extMatch = item.file_name?.match(/\.([^\.]+)$/);
    if (extMatch) {
      this.previewFileType = extMatch[1].toLowerCase();
    }
    
    this.isPreviewModalOpen = true;
  }

  closePreview() {
    this.isPreviewModalOpen = false;
    this.previewUrl = null;
    this.previewFileType = '';
  }

  hasMultipleCompleted(fileName: string): boolean {
    if (!fileName) return false;
    return this.queue.filter(q => q.file_name === fileName && q.status === 'completed').length >= 2;
  }

  compareExtractions(fileName: string, event: Event) {
    event.stopPropagation();
    if (!fileName) return;

    this.http.get(`http://localhost:3000/api/document-pipeline/compare/${encodeURIComponent(fileName)}`).subscribe({
      next: (data: any) => {
        if (!Array.isArray(data) || data.length < 2) {
          alert('Not enough completed extractions to compare.');
          return;
        }
        // Left = older extraction, right = newer extraction
        const newer = data[0];
        const older = data[1];

        this.compareDataLeft = this.flattenObject(older.extracted_data || {});
        this.compareDataRight = this.flattenObject(newer.extracted_data || {});

        const allKeys = new Set([...Object.keys(this.compareDataLeft), ...Object.keys(this.compareDataRight)]);
        this.compareKeys = Array.from(allKeys).sort();

        this.isCompareModalOpen = true;
      },
      error: (err) => {
        console.error('Error fetching comparison details', err);
        alert('Failed to load comparison details.');
      }
    });
  }

  closeCompareModal() {
    this.isCompareModalOpen = false;
    this.compareDataLeft = {};
    this.compareDataRight = {};
    this.compareKeys = [];
  }

  getCompareStatusClass(key: string): string {
    const leftHas = this.compareDataLeft.hasOwnProperty(key);
    const rightHas = this.compareDataRight.hasOwnProperty(key);
    
    if (!leftHas || !rightHas) {
      return 'compare-missing'; // red
    }
    if (this.compareDataLeft[key] === this.compareDataRight[key]) {
      return 'compare-same'; // green
    }
    return 'compare-changed'; // yellow
  }

  openEditModal(item: any, event: Event) {
    event.stopPropagation();
    if (item.status !== 'completed') return;

    this.http.get(`http://localhost:3000/api/document-pipeline/queue/${item.id}/extraction`).subscribe({
      next: (data: any) => {
        this.editingItem = item;
        this.editFields = this.flattenObject(data.extracted_data || {});
        this.editFormKeys = Object.keys(this.editFields);
        this.isEditModalOpen = true;
      },
      error: (err) => {
        console.error('Error fetching extraction for editing', err);
        alert('Failed to load extraction for editing.');
      }
    });
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editingItem = null;
    this.editFields = {};
    this.editFormKeys = [];
  }

  saveEditedExtraction() {
    if (!this.editingItem || !this.editingItem.id) return;

    this.http.put(`http://localhost:3000/api/document-pipeline/queue/${this.editingItem.id}/extraction`, JSON.stringify(this.editFields), {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (data: any) => {
        alert('Changes saved successfully');
        this.closeEditModal();
      },
      error: (err) => {
        console.error('Full error response:', err);
        alert('Failed to save changes');
      }
    });
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedExtraction = null;
  }

  retryItem(item: any, event: Event) {
    event.stopPropagation();
    if (item.status !== 'failed') return;

    this.http.post(`http://localhost:3000/api/document-pipeline/retry/${item.id}`, {}).subscribe({
      next: () => {
        this.fetchStats();
        this.fetchQueue();
      },
      error: (err) => {
        console.error('Error retrying', err);
        alert('Failed to retry');
      }
    });
  }

  objectKeys(obj: any) {
    return obj ? Object.keys(obj) : [];
  }

  formatValue(value: any): string {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  loadStats() {
    this.fetchStats();
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  onStatusChange(event: any) {
    this.statusFilter = event.target.value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredQueue = this.queue.filter(item => {
      const matchesSearch = item.file_name ? item.file_name.toLowerCase().includes(this.searchTerm.toLowerCase()) : false;
      const matchesStatus = this.statusFilter === 'All' || item.status === this.statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }

  isObject(val: any): boolean {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  calculateTimeTaken(created_at: string, completed_at: string): string {
    if (!completed_at) return '-';
    
    const start = new Date(created_at).getTime();
    const end = new Date(completed_at).getTime();
    const diffSeconds = Math.round((end - start) / 1000);
    
    if (diffSeconds < 0) return '-';
    
    return `${diffSeconds}s`;
  }

  isArray(val: any): boolean {
    return Array.isArray(val);
  }

  getCategoryClass(catName: string) {
    const cat = (catName || '').toLowerCase();
    if (cat.includes('invoice')) return 'cat-invoice';
    if (cat.includes('salary')) return 'cat-salary';
    if (cat.includes('bank')) return 'cat-bank';
    if (cat.includes('aadhaar')) return 'cat-aadhaar';
    if (cat.includes('pan')) return 'cat-pan';
    if (cat.includes('offer')) return 'cat-offer';
    return 'cat-unknown';
  }

  getConfidenceClass(score: number) {
    if (score > 70) return 'conf-high';
    if (score >= 40) return 'conf-med';
    return 'conf-low';
  }

  itemToDelete: any = null;

  deleteItem(item: any, event: Event) {
    event.stopPropagation();
    this.itemToDelete = item;
  }

  cancelDelete() {
    this.itemToDelete = null;
  }

  confirmDelete() {
    if (!this.itemToDelete) return;
    const item = this.itemToDelete;
    
    this.http.delete(`http://localhost:3000/api/document-pipeline/queue/${item.id}`).subscribe({
      next: () => {
        this.queue = this.queue.filter(q => q.id !== item.id);
        this.applyFilters();
        this.itemToDelete = null;
        this.fetchStats(); // Update the stats after deletion
      },
      error: (err) => {
        console.error('Error deleting item', err);
        alert('Failed to delete item');
        this.itemToDelete = null;
      }
    });
  }
}

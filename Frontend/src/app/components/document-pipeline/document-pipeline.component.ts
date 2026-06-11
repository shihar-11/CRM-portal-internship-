import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-document-pipeline',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './document-pipeline.component.html',
  styleUrl: './document-pipeline.component.css'
})
export class DocumentPipelineComponent implements OnInit {
  stats: any = { pending: 0, processing: 0, completed: 0, failed: 0 };
  queue: any[] = [];
  selectedExtraction: any = null;
  isModalOpen = false;
  loadingStats = true;
  loadingQueue = true;

  constructor(private http: HttpClient) {}

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

  isObject(val: any): boolean {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
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

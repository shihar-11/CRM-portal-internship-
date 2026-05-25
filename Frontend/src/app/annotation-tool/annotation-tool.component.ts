import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { BillScannerService } from '../bill-scanner/bill-scanner.service';
import { NotificationService } from '../notification.service';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

@Component({
  selector: 'app-annotation-tool',
  templateUrl: './annotation-tool.component.html',
  styleUrls: ['./annotation-tool.component.css']
})
export class AnnotationToolComponent implements OnInit {
  isDragging = false;
  selectedFile: File | null = null;

  // Annotation State
  pdfDocument: any = null;
  pdfPages: number[] = [];
  pagesRendered: boolean[] = [];
  showStorageInfo = false;
  documentType = 'work_order';
  isTestSuccessful = false;
  isDrawing = false;
  drawingPage = 0;
  startX = 0;
  startY = 0;
  drawingBox = { x: 0, y: 0, width: 0, height: 0, pct: { x: 0, y: 0, w: 0, h: 0 } };
  
  showLabelModal = false;
  selectedLabel = '';
  customLabel = '';
  
  annotations: any[] = [];
  isSavingAnnotations = false;

  labelOptions = [
    'Work Order No', 'Date', 'Project No', 'Project Name', 
    'Vendor Name', 'Contact Person', 'Address', 'Phone Number', 
    'Email', 'Grand Total', 'Line Item - Description', 
    'Line Item - Amount', 'Other'
  ];

  colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#33FFF5', '#F5FF33', '#FF8C33'];

  constructor(
    private billScannerService: BillScannerService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
  }

  resetScanner() {
    this.selectedFile = null;
    this.pdfDocument = null;
    this.pdfPages = [];
    this.pagesRendered = [];
    this.annotations = [];
    this.isTestSuccessful = false;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isDragging = true;
  }
  onDragLeave(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isDragging = false;
  }
  onDrop(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }
  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.handleFile(event.target.files[0]);
    }
  }

  handleFile(file: File) {
    if (file.type === 'application/pdf') {
      this.selectedFile = file;
      this.pdfDocument = null;
      this.pagesRendered = [];
      this.annotations = [];
      this.isTestSuccessful = false;
      this.renderPdf(file);
    } else {
      this.notificationService.showError('Annotation tool only supports PDF files.');
    }
  }

  // --- PDF ANNOTATION LOGIC ---

  async renderPdf(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      this.pdfDocument = await pdfjsLib.getDocument({ data: buffer }).promise;
      this.pdfPages = Array.from({ length: this.pdfDocument.numPages }, (_, i) => i + 1);
      this.pagesRendered = Array.from({ length: this.pdfDocument.numPages + 1 }, () => false);
      this.cdr.detectChanges(); // Force angular to render the canvas elements

      setTimeout(() => {
        this.checkAndRenderPDF();
      }, 100);
    } catch (error) {
      console.error('Error rendering PDF', error);
      this.notificationService.showError('Could not render PDF for annotation.');
    }
  }

  async renderPage(pageNumber: number) {
    const page = await this.pdfDocument.getPage(pageNumber);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.getElementById(`pdf-canvas-${pageNumber}`) as HTMLCanvasElement;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = { canvasContext: context, viewport: viewport };
    await page.render(renderContext).promise;
    this.pagesRendered[pageNumber] = true;
  }

  checkAndRenderPDF() {
    if (!this.pdfDocument) return;
    for (let i = 1; i <= this.pdfDocument.numPages; i++) {
      if (!this.pagesRendered[i]) {
        this.renderPage(i);
      }
    }
  }

  onMouseDown(event: MouseEvent, pageNumber: number) {
    this.isDrawing = true;
    this.drawingPage = pageNumber;
    this.startX = event.offsetX;
    this.startY = event.offsetY;
    this.drawingBox = { x: this.startX, y: this.startY, width: 0, height: 0, pct: { x: 0, y: 0, w: 0, h: 0 } };
  }

  onMouseMove(event: MouseEvent, pageNumber: number) {
    if (!this.isDrawing || this.drawingPage !== pageNumber) return;
    const currentX = event.offsetX;
    const currentY = event.offsetY;
    
    this.drawingBox.x = Math.min(this.startX, currentX);
    this.drawingBox.y = Math.min(this.startY, currentY);
    this.drawingBox.width = Math.abs(currentX - this.startX);
    this.drawingBox.height = Math.abs(currentY - this.startY);
  }

  onMouseUp(event: MouseEvent, pageNumber: number) {
    if (!this.isDrawing || this.drawingPage !== pageNumber) return;
    this.isDrawing = false;
    
    if (this.drawingBox.width > 10 && this.drawingBox.height > 10) {
      // Calculate normalized percentages
      const target = event.currentTarget as HTMLElement;
      const totalWidth = target.clientWidth;
      const totalHeight = target.clientHeight;
      
      this.drawingBox.pct = {
        x: (this.drawingBox.x / totalWidth) * 100,
        y: (this.drawingBox.y / totalHeight) * 100,
        w: (this.drawingBox.width / totalWidth) * 100,
        h: (this.drawingBox.height / totalHeight) * 100
      };

      this.selectedLabel = '';
      this.customLabel = '';
      this.showLabelModal = true;
    }
  }

  onMouseLeave(event: MouseEvent) {
    this.isDrawing = false;
  }

  onLabelSelectChange() {
    if (this.selectedLabel !== 'Other') {
      this.customLabel = '';
    }
  }

  confirmAnnotation() {
    const fieldName = this.selectedLabel === 'Other' ? this.customLabel : this.selectedLabel;
    const color = this.colors[this.annotations.length % this.colors.length];
    
    this.annotations.push({
      field_name: fieldName,
      page_number: this.drawingPage,
      coordinates: { x: this.drawingBox.x, y: this.drawingBox.y, width: this.drawingBox.width, height: this.drawingBox.height },
      normalized: { x_pct: this.drawingBox.pct.x, y_pct: this.drawingBox.pct.y, w_pct: this.drawingBox.pct.w, h_pct: this.drawingBox.pct.h },
      custom_field: this.selectedLabel === 'Other',
      color: color
    });

    this.showLabelModal = false;
  }

  cancelAnnotation() {
    this.showLabelModal = false;
  }

  getAnnotationsForPage(page: number) {
    return this.annotations.filter(a => a.page_number === page);
  }

  removeAnnotation(index: number) {
    this.annotations.splice(index, 1);
  }

  saveMappings() {
    if (!this.selectedFile) return;
    this.isSavingAnnotations = true;
    
    const structuredAnnotations = {
      template_version: "1.0",
      document_type: this.documentType,
      created_at: new Date().toISOString(),
      fields: {} as any,
      custom_fields: {} as any
    };

    this.annotations.forEach(ann => {
      const key = ann.field_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const fieldData = {
        label: ann.field_name,
        page: ann.page_number,
        normalized: {
          x: ann.normalized.x_pct,
          y: ann.normalized.y_pct,
          w: ann.normalized.w_pct,
          h: ann.normalized.h_pct
        },
        pdf_units: {
          x: ann.coordinates.x / 1.5,
          y: ann.coordinates.y / 1.5,
          w: ann.coordinates.width / 1.5,
          h: ann.coordinates.height / 1.5
        },
        custom_field: ann.custom_field || false
      };

      if (ann.custom_field) {
        structuredAnnotations.custom_fields[key] = fieldData;
      } else {
        structuredAnnotations.fields[key] = fieldData;
      }
    });
    
    const payload = {
      document_name: this.selectedFile.name,
      document_type: this.documentType,
      annotations: structuredAnnotations
    };

    this.billScannerService.saveAnnotations(payload).subscribe({
      next: (res) => {
        this.isSavingAnnotations = false;
        this.isTestSuccessful = true;
        this.notificationService.showSuccess('Training data saved successfully!');
        setTimeout(() => {
          this.isTestSuccessful = false;
        }, 3000);
      },
      error: (err) => {
        this.isSavingAnnotations = false;
        const errMsg = err.error?.error || err.message || 'Unknown error occurred.';
        this.notificationService.showError('Failed to save training data: ' + errMsg);
        console.error('Save Mapping Error:', err);
      }
    });
  }
}

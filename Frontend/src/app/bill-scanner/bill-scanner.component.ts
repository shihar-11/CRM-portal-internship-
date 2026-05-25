import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { BillScannerService } from './bill-scanner.service';
import { LeadService } from '../lead.service';
import { NotificationService } from '../notification.service';
import { Router } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

@Component({
  selector: 'app-bill-scanner',
  templateUrl: './bill-scanner.component.html',
  styleUrls: ['./bill-scanner.component.css']
})
export class BillScannerComponent implements OnInit {
  currentView: 'upload' | 'results' = 'upload';
  activeTab: 'extracted' | 'annotation' = 'extracted';
  isDragging = false;
  selectedFile: File | null = null;
  isExtracting = false;
  extractionComplete = false;
  showCandidates = false;

  billForm!: FormGroup;
  candidates: { all_names: any[]; all_phones: any[]; all_emails: any[]; } = { all_names: [], all_phones: [], all_emails: [] };

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
    private fb: FormBuilder,
    private billScannerService: BillScannerService,
    private leadService: LeadService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.billForm = this.fb.group({
      work_order_no: [''], date: [''], project_no: [''], project_name: [''],
      primary_vendor_name: [''], primary_contact_person: [''], address: [''],
      primary_phone: [''], primary_email: [''],
      line_items: this.fb.array([]), grand_total: ['']
    });
  }

  get lineItems(): FormArray { return this.billForm.get('line_items') as FormArray; }

  addLineItem(item: any = {}) {
    const itemGroup = this.fb.group({
      sno: [item.sno || ''], hsn_sac_code: [item.hsn_sac_code || ''], description: [item.description || ''],
      no_of_persons: [item.no_of_persons || ''], required_period: [item.required_period || ''],
      unit_rate: [item.unit_rate || ''], date_from: [item.date_from || ''], date_to: [item.date_to || ''],
      total_amount: [item.total_amount || ''], cgst_percent: [item.cgst_percent || ''], cgst_amount: [item.cgst_amount || ''],
      sgst_percent: [item.sgst_percent || ''], sgst_amount: [item.sgst_amount || ''], igst_percent: [item.igst_percent || ''],
      igst_amount: [item.igst_amount || '']
    });
    this.lineItems.push(itemGroup);
  }

  removeLineItem(index: number) { this.lineItems.removeAt(index); }

  switchTab(tab: 'extracted' | 'annotation') {
    this.activeTab = tab;
    if (this.activeTab === 'annotation' && this.selectedFile) {
      if (this.selectedFile.type === 'application/pdf') {
        if (!this.pdfDocument) {
          this.renderPdf(this.selectedFile);
        } else {
          this.cdr.detectChanges(); // Ensure DOM is unhidden before rendering
          setTimeout(() => this.checkAndRenderPDF(), 50);
        }
      } else {
        this.notificationService.showInfo('Annotation tool only supports PDF files currently.');
        this.activeTab = 'extracted'; // Fallback
      }
    }
  }

  resetScanner() {
    this.currentView = 'upload';
    this.activeTab = 'extracted';
    this.selectedFile = null;
    this.extractionComplete = false;
    this.lineItems.clear();
    this.billForm.reset();
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
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (validTypes.includes(file.type)) {
      this.selectedFile = file;
      this.extractionComplete = false;
      this.lineItems.clear();
      this.billForm.reset();
      this.pdfDocument = null;
      this.pagesRendered = [];
      this.annotations = [];
      this.isTestSuccessful = false;
    } else {
      alert('Invalid file type. Please upload a PDF, JPG, or PNG.');
    }
  }

  extractData() {
    if (!this.selectedFile) return;
    this.isExtracting = true;
    
    // Check if we are in annotation mode and want to test it
    const passAnns = this.annotations.length > 0 ? this.annotations : undefined;

    this.billScannerService.scanDocument(this.selectedFile, passAnns).subscribe({
      next: (res) => {
        this.isExtracting = false;
        this.extractionComplete = true;
        
        this.candidates = {
          all_names: res.all_names || [],
          all_phones: res.all_phones || [],
          all_emails: res.all_emails || []
        };

        this.billForm.patchValue({
          work_order_no: res.work_order_no || '', date: res.date || '',
          project_no: res.project_no || '', project_name: res.project_name || '',
          primary_vendor_name: res.primary_vendor_name || '', primary_contact_person: res.primary_contact_person || '',
          address: res.address || '', primary_phone: res.primary_phone || '',
          primary_email: res.primary_email || '', grand_total: res.grand_total || ''
        });

        this.lineItems.clear();
        if (res.line_items && Array.isArray(res.line_items)) {
          res.line_items.forEach((item: any) => this.addLineItem(item));
        }
        
        this.currentView = 'results';
        this.activeTab = 'extracted';
        this.notificationService.showSuccess('Data extracted successfully!');
      },
      error: (err) => {
        this.isExtracting = false;
        const errMsg = err.error?.error || err.message || 'Unknown error occurred.';
        this.notificationService.showError('Extraction failed: ' + errMsg);
        console.error('Extraction Error:', err);
      }
    });
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
      console.log('Processing annotation:', ann.field_name, '→ key:', key);
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

    console.log('=== FRONTEND SENDING PAYLOAD ===');
    console.log('Total annotations:', this.annotations.length);
    console.log('Payload being sent:', JSON.stringify(payload, null, 2));

    this.billScannerService.saveAnnotations(payload).subscribe({
      next: (res) => {
        this.isSavingAnnotations = false;
        this.isTestSuccessful = true;
        setTimeout(() => {
          this.isTestSuccessful = false;
          // Automatically trigger extraction to test mappings
          this.extractData();
        }, 1500);
      },
      error: (err) => {
        this.isSavingAnnotations = false;
        const errMsg = err.error?.error || err.message || 'Unknown error occurred.';
        this.notificationService.showError('Failed to save training data: ' + errMsg);
        console.error('Save Mapping Error:', err);
      }
    });
  }

  // --- REST OF COMPONENT ---

  toggleCandidates() { this.showCandidates = !this.showCandidates; }
  candidateOverride(field: string, value: string) {
    this.billForm.patchValue({ [field]: value });
    this.notificationService.showInfo(`Updated ${field} with selected candidate.`);
  }
  isNullOrEmpty(field: string): boolean {
    const val = this.billForm.get(field)?.value;
    return val === null || val === undefined || val === '';
  }
  saveAsLead() {
    const values = this.billForm.value;
    const finalNotes = `Phone: ${values.primary_phone || ''}\nProject No: ${values.project_no || ''}\nWork Order No: ${values.work_order_no || ''}\nAddress: ${values.address || ''}`;
    const payload = {
      name: values.primary_vendor_name || 'Unknown Vendor', email: values.primary_email || '',
      status: 'New', source: 'Bill Scanner', notes: finalNotes, department: values.project_name || 'General'
    };
    this.leadService.addLead(payload).subscribe({
      next: (res) => {
        this.notificationService.showSuccess('Lead saved successfully from Bill Scanner!');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.notificationService.showError('Error saving lead.'); console.error(err);
      }
    });
  }
}

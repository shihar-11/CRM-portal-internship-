import { Component, OnInit, OnDestroy } from '@angular/core';
import { BillScannerService } from './bill-scanner.service';
import { LeadService } from '../lead.service';
import { NotificationService } from '../notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-bill-scanner',
  templateUrl: './bill-scanner.component.html',
  styleUrls: ['./bill-scanner.component.css']
})
export class BillScannerComponent implements OnInit, OnDestroy {
  currentStep = 1;
  isExtracting = false;
  cooldownRemaining = 0;
  isDragging = false;
  selectedFile: File | null = null;
  templateMissingError: string | null = null;
  customerTab: 'new' | 'existing' = 'existing';
  searchQuery = '';
  showOrderDetails = true;

  orderData = {
    document_type: 'Work Order',
    order_no: '',
    order_date: '',
    project_number: '',
    project_name: '',
    order_start: '',
    order_end: '',
    billing_cycle: 'Monthly',
    no_of_billing_cycles: 3,
    document_file: null as File | null,
    customer: {
      is_existing: false,
      name: '',
      email: '',
      mobile: '',
      gst_number: '',
      pan_number: '',
      official_address: '',
      contract_state: '',
      website: ''
    },
    contact_persons: [
      { name: '', designation: '', email: '', mobile: '', isNew: true }
    ],
    resource_demand: [] as any[],
    billing_subscriptions: [] as any[],
    total_billing: 0,
    total_subscription: 0
  };

  documentTypes = [
    { id: 'Work Order', icon: 'fa-briefcase', label: 'Work Order' },
    { id: 'Purchase Order', icon: 'fa-cart-shopping', label: 'Purchase Order' },
    { id: 'Invoice', icon: 'fa-file-invoice-dollar', label: 'Invoice' },
    { id: 'Custom', icon: 'fa-screwdriver-wrench', label: 'Custom' }
  ];
  billingCycles = ['Monthly', 'Quarterly', 'Yearly'];
  states = ['Andhra Pradesh', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana'];

  constructor(
    private billScannerService: BillScannerService,
    private leadService: LeadService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.billScannerService.hasCachedState) {
      this.orderData = this.billScannerService.cachedOrderData;
      this.currentStep = this.billScannerService.cachedStep;
    }
  }

  ngOnDestroy(): void {
    this.billScannerService.cachedOrderData = this.orderData;
    this.billScannerService.cachedStep = this.currentStep;
    this.billScannerService.hasCachedState = true;
  }

  nextStep() {
    if (this.currentStep < 4) this.currentStep++;
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  selectType(type: string) {
    this.orderData.document_type = type;
  }

  toggleOrderDetails() {
    this.showOrderDetails = !this.showOrderDetails;
  }

  // File Upload Logic
  onDragOver(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isDragging = true;
  }
  onDragLeave(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isDragging = false;
  }
  onDrop(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (this.validateFile(file, event)) {
        this.handleFile(file);
      }
    }
  }
  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (this.validateFile(file, event)) {
        this.handleFile(file);
      }
    }
  }

  private validateFile(file: File, event?: any): boolean {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type) || file.size > maxSize) {
      this.selectedFile = null;
      this.orderData.document_file = null;
      if (event && event.target && 'value' in event.target) {
        event.target.value = '';
      }
      this.notificationService.showError('Invalid file. Please upload a PDF, PNG, or JPEG under 5MB.');
      return false;
    }
    return true;
  }

  handleFile(file: File) {
    this.selectedFile = file;
    this.orderData.document_file = file;
  }

  scanDocument() {
    if (!this.selectedFile) return;
    this.isExtracting = true;
    this.templateMissingError = null;
    
    this.billScannerService.scanDocument(this.selectedFile, undefined, this.orderData.document_type).subscribe({
      next: (res: any) => {
        this.isExtracting = false;
        
        // 1. Reset orderData to defaults to avoid stale data
        this.orderData = {
          document_type: this.orderData.document_type, // keep current type
          order_no: '',
          order_date: '',
          project_number: '',
          project_name: '',
          order_start: '',
          order_end: '',
          billing_cycle: 'Monthly',
          no_of_billing_cycles: 3,
          document_file: this.orderData.document_file, // keep file
          customer: {
            is_existing: false,
            name: '',
            email: '',
            mobile: '',
            gst_number: '',
            pan_number: '',
            official_address: '',
            contract_state: '',
            website: ''
          },
          contact_persons: [
            { name: '', designation: '', email: '', mobile: '', isNew: true }
          ],
          resource_demand: [] as any[],
          billing_subscriptions: [] as any[],
          total_billing: 0,
          total_subscription: 0
        };

        const extracted = res.extracted || {};
        const mappedFields = res.mapped_fields || [];

        // 2. Forcefully map extracted fields to the UI model, checking standard schema keys first, then custom DB keys
        this.orderData.order_no = extracted.order_no || extracted.work_order_no || '';
        this.orderData.project_number = extracted.project_number || extracted.project_no || '';
        this.orderData.customer.name = extracted.customer?.name || extracted.vendor_name || '';
        this.orderData.customer.mobile = extracted.customer?.mobile || extracted.phone_number || '';
        
        // Map remaining fields similarly
        this.orderData.project_name = extracted.project_name || '';
        this.orderData.customer.email = extracted.customer?.email || extracted.email || '';
        this.orderData.contact_persons[0].name = extracted.contact_persons || '';
        this.orderData.contact_persons[0].mobile = extracted.customer?.mobile || extracted.phone_number || '';
        this.orderData.order_date = extracted.order_date || extracted.date || '';
        this.orderData.customer.official_address = extracted.customer?.official_address || extracted.address || '';

        // Auto generate if none returned
        this.generateSubscriptions();

        this.calculateTotals();
        this.notificationService.showSuccess('Document scanned successfully');
        this.nextStep();
        this.startCooldown();
      },
      error: (err) => {
        this.isExtracting = false;
        const errMsg = err.error?.error || err.message || 'Unknown error occurred.';
        
        if (errMsg.includes('No annotation template found') || err.status === 404) {
          this.templateMissingError = err.error?.error || `No annotation template found for document type '${this.orderData.document_type}'. Please use the Annotation Tool to map fields first.`;
        } else {
          this.notificationService.showError('Scanning failed: ' + errMsg);
        }
        console.error('Extraction Error:', err);
        this.startCooldown();
      }
    });
  }

  startCooldown() {
    this.cooldownRemaining = 5;
    const interval = setInterval(() => {
      this.cooldownRemaining--;
      if (this.cooldownRemaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  }

  searchExistingCustomer() {
    if (this.searchQuery.toLowerCase().includes('environment')) {
      this.orderData.customer.name = 'Ministry of Environment, Forest and Climate change';
      this.orderData.customer.email = 'navinnkk@nic.in';
      this.orderData.customer.mobile = '9868829908';
      this.orderData.customer.gst_number = '22AAAAA0000A1Z5';
      this.orderData.customer.pan_number = 'ABCDE1234F';
      this.orderData.customer.official_address = 'MoEFCC, NIC Cell, Agri Wing, 3rd Floor, Indira Paryavaran Bhawan, Jor Bagh, New Delhi-, Delhi';
      this.orderData.customer.contract_state = 'Delhi';
      
      this.orderData.contact_persons = [{
        name: 'Navin Kishore Karn',
        designation: 'Role',
        email: 'navinnkk@nic.in',
        mobile: '9868829908',
        isNew: false
      }];
    }
  }

  addContact() {
    this.orderData.contact_persons.push({ name: '', designation: '', email: '', mobile: '', isNew: true });
  }

  editContact(index: number) {
    this.orderData.contact_persons[index].isNew = true;
  }

  newContact(index: number) {
    this.orderData.contact_persons[index] = { name: '', designation: '', email: '', mobile: '', isNew: true };
  }

  addDemand() {
    this.orderData.resource_demand.push({
      checked: true,
      job_role: '',
      experience: '',
      qty: 1,
      start_date: this.orderData.order_start,
      end_date: this.orderData.order_end,
      unit_rate: 0,
      billing_amount: 0
    });
  }

  removeDemand(index: number) {
    this.orderData.resource_demand.splice(index, 1);
    this.calculateTotals();
  }

  calculateDemandBilling(index: number) {
    const d = this.orderData.resource_demand[index];
    d.billing_amount = d.qty * d.unit_rate * (this.orderData.no_of_billing_cycles || 1);
    this.calculateTotals();
  }

  generateSubscriptions() {
    this.orderData.billing_subscriptions = [];
    const count = this.orderData.no_of_billing_cycles || 0;
    const prefix = this.orderData.billing_cycle === 'Monthly' ? 'M' : this.orderData.billing_cycle === 'Quarterly' ? 'Q' : 'Y';
    
    // Total from resource demand
    let totalRate = 0;
    this.orderData.resource_demand.forEach(d => {
      if(d.checked) totalRate += d.qty * d.unit_rate;
    });

    for (let i = 1; i <= count; i++) {
      this.orderData.billing_subscriptions.push({
        checked: true,
        subscription_id: `${prefix} ${i}`,
        description: `Billing for cycle ${i}`,
        date: '',
        amount: totalRate,
        status: 'Pending'
      });
    }
    this.calculateTotals();
  }

  addSubscription() {
    this.orderData.billing_subscriptions.push({
      checked: true,
      subscription_id: '',
      description: '',
      date: '',
      amount: 0,
      status: 'Pending'
    });
  }

  removeSubscription(index: number) {
    this.orderData.billing_subscriptions.splice(index, 1);
    this.calculateTotals();
  }

  calculateTotals() {
    this.orderData.total_billing = this.orderData.resource_demand.reduce((sum, d) => d.checked ? sum + (d.billing_amount || 0) : sum, 0);
    this.orderData.total_subscription = this.orderData.billing_subscriptions.reduce((sum, s) => s.checked ? sum + (s.amount || 0) : sum, 0);
  }

  cancelOrder() {
    this.router.navigate(['/dashboard']);
  }

  saveOrder() {
    const checkedDemands = this.orderData.resource_demand.filter(d => d.checked);
    const checkedSubscriptions = this.orderData.billing_subscriptions.filter(s => s.checked);

    const payload = {
      name: this.orderData.customer.name || 'Unknown',
      email: this.orderData.customer.email || '',
      phone: this.orderData.customer.mobile || '',
      company: this.orderData.customer.name || 'Unknown',
      source: 'ocr_template',
      status: 'New',
      department: this.orderData.project_name || 'General',
      notes: JSON.stringify({
        order_no: this.orderData.order_no,
        order_date: this.orderData.order_date,
        project_number: this.orderData.project_number,
        project_name: this.orderData.project_name,
        order_start: this.orderData.order_start,
        order_end: this.orderData.order_end,
        billing_cycle: this.orderData.billing_cycle,
        no_of_billing_cycles: this.orderData.no_of_billing_cycles,
        customer: this.orderData.customer,
        contact_persons: this.orderData.contact_persons,
        resource_demand: checkedDemands,
        billing_subscriptions: checkedSubscriptions,
        total_billing: this.orderData.total_billing,
        total_subscription: this.orderData.total_subscription,
        document_type: this.orderData.document_type
      })
    };

    this.leadService.addLead(payload).subscribe({
      next: (res) => {
        this.billScannerService.clearCache();
        this.notificationService.showSuccess('Order saved as lead successfully!');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.notificationService.showError('Error saving order.');
        console.error(err);
      }
    });
  }
}

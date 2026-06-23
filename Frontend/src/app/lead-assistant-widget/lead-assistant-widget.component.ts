import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LeadService } from '../lead.service';
import { SseStreamService } from '../services/sse-stream.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-lead-assistant-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-assistant-widget.component.html',
  styleUrls: ['./lead-assistant-widget.component.css']
})
export class LeadAssistantWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatArea') private chatArea!: ElementRef;

  isOpen = false;
  activeTab: 'Chat' | 'HotLeads' = 'Chat';
  
  // Chat State
  userInput = '';
  isTyping = false;
  chatHistory: { role: 'user' | 'model', text: string, isError?: boolean }[] = [];
  private previousMessageCount = 0;
  
  hotLeads: any[] = [];
  isLoading = false;
  private sseSub!: Subscription;
  private hasFetchedLeads = false;

  // Drag State
  isDragModeReady = false;
  isDragging = false;
  dragRight: number | null = null;
  dragBottom: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialRight = 24;
  private initialBottom = 24;
  private clickTimeout: any;

  constructor(
    private leadService: LeadService,
    private sseService: SseStreamService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    this.sseSub = this.sseService.messages$.subscribe(msg => {
      if (msg.type === 'HOT_LEADS_UPDATED' && this.hasFetchedLeads) {
        // Replace list seamlessly
        this.hotLeads = msg.data;
      }
    });
  }

  ngOnDestroy() {
    if (this.sseSub) {
      this.sseSub.unsubscribe();
    }
  }

  ngAfterViewChecked() {
    if (this.chatHistory.length > this.previousMessageCount) {
      this.scrollToBottom();
      this.previousMessageCount = this.chatHistory.length;
    }
  }

  scrollToBottom(): void {
    try {
      if (this.chatArea) {
        this.chatArea.nativeElement.scrollTop = this.chatArea.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  onIconClick(event: MouseEvent) {
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
    } else {
      this.clickTimeout = setTimeout(() => {
        this.togglePanel();
        this.clickTimeout = null;
      }, 250);
    }
  }

  onIconDoubleClick(event: MouseEvent) {
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
    }
    if (this.isOpen) {
      this.isOpen = false;
    }
    this.isDragModeReady = true;
  }

  onIconMouseDown(event: MouseEvent) {
    if (!this.isDragModeReady) return;
    this.isDragging = true;
    
    const computed = window.getComputedStyle(this.elementRef.nativeElement.querySelector('.widget-container'));
    this.initialRight = parseFloat(computed.right) || 24;
    this.initialBottom = parseFloat(computed.bottom) || 24;
    
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    
    event.preventDefault(); // Prevent text selection while dragging
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    
    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;
    
    let newRight = this.initialRight - deltaX;
    let newBottom = this.initialBottom - deltaY;
    
    const btnRect = this.elementRef.nativeElement.querySelector('.widget-btn').getBoundingClientRect();
    const btnWidth = btnRect.width || 56;
    const btnHeight = btnRect.height || 56;
    
    if (newRight < 0) newRight = 0;
    if (newRight > window.innerWidth - btnWidth) newRight = window.innerWidth - btnWidth;
    
    if (newBottom < 0) newBottom = 0;
    if (newBottom > window.innerHeight - btnHeight) newBottom = window.innerHeight - btnHeight;
    
    this.dragRight = newRight;
    this.dragBottom = newBottom;
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    if (this.isDragging) {
      this.isDragging = false;
      this.isDragModeReady = false; // Exit drag mode on drop
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen) {
      const clickedInside = this.elementRef.nativeElement.contains(event.target);
      if (!clickedInside) {
        this.isOpen = false;
      }
    }
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    // If opening directly to HotLeads, fetch if not already done
    if (this.isOpen && this.activeTab === 'HotLeads' && !this.hasFetchedLeads) {
      this.fetchHotLeads();
    }
  }

  switchTab(tab: 'Chat' | 'HotLeads') {
    this.activeTab = tab;
    if (tab === 'HotLeads' && !this.hasFetchedLeads) {
      this.fetchHotLeads();
    }
  }

  fetchHotLeads() {
    this.isLoading = true;
    this.leadService.getHotLeads(5).subscribe({
      next: (data) => {
        this.hotLeads = data;
        this.isLoading = false;
        this.hasFetchedLeads = true;
      },
      error: (err) => {
        console.error('Failed to fetch hot leads', err);
        this.isLoading = false;
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'A';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  navigateToLead(lead: any) {
    this.isOpen = false;
    this.router.navigate(['/dashboard']).then(() => {
      this.leadService.triggerOpenLeadModal(lead);
    });
  }

  onEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    
    // Only intercept the Enter key
    if (keyboardEvent.key !== 'Enter') {
      return;
    }

    // If Shift+Enter, allow newline
    if (keyboardEvent.shiftKey) {
      return; 
    }
    
    // Otherwise prevent default and send
    keyboardEvent.preventDefault();
    this.sendMessage();
  }

  sendMessage() {
    const text = this.userInput.trim();
    if (!text || this.isTyping) return;

    // 1. Add user message
    this.chatHistory.push({ role: 'user', text });
    this.userInput = '';
    this.isTyping = true;

    // 2. Prepare payload (last 10 context exchanges excluding the one we just pushed)
    // Wait, the API needs the history up to the previous turn, not including the current message in the history array.
    // We pass the new message separately.
    const contextHistory = this.chatHistory
      .slice(0, -1) // Exclude the message we just added
      .filter(m => !m.isError) // Don't send errors back as history
      .slice(-10); // Keep only last 10 messages

    // 3. Call API
    this.leadService.queryChatbot(text, contextHistory).subscribe({
      next: (response) => {
        this.chatHistory.push({ role: 'model', text: response.reply });
        this.isTyping = false;
      },
      error: (err) => {
        console.error('Chat API Error:', err);
        this.chatHistory.push({ 
          role: 'model', 
          text: 'Something went wrong, try again.', 
          isError: true 
        });
        this.isTyping = false;
      }
    });
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentPipelineComponent } from './document-pipeline.component';

describe('DocumentPipelineComponent', () => {
  let component: DocumentPipelineComponent;
  let fixture: ComponentFixture<DocumentPipelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentPipelineComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DocumentPipelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

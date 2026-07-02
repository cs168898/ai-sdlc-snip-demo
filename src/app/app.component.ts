import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Link, LinkService } from './link.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private svc = inject(LinkService);

  urlValue = '';
  links = signal<Link[]>([]);
  newLink = signal<Link | null>(null);
  error = signal('');
  loading = signal(false);

  ngOnInit() {
    this.reload();
  }

  private reload() {
    this.svc.getAll().subscribe({
      next: (list) => this.links.set(list),
    });
  }

  private isHttp(str: string) {
    try {
      const { protocol } = new URL(str);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  shorten() {
    if (!this.isHttp(this.urlValue)) {
      this.error.set('Please enter a valid http(s) URL.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.newLink.set(null);

    this.svc.create(this.urlValue).subscribe({
      next: (link) => {
        this.newLink.set(link);
        this.urlValue = '';
        this.loading.set(false);
        this.reload();
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Network error — is the backend running?');
        this.loading.set(false);
      },
    });
  }
}

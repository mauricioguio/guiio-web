import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

const CLOUD_NAME = 'drp8ofkl4';
const UPLOAD_PRESET = 'guiio-producs';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly http = inject(HttpClient);

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', UPLOAD_PRESET);
    return this.http
      .post<{ secure_url: string }>(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        form,
      )
      .pipe(map(res => res.secure_url.replace('/upload/', '/upload/f_auto,q_auto/')));
  }
}

import { Component } from '@angular/core';
import { FormBuilder, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { EMPTY, merge, Observable, Subject, timer } from 'rxjs';
import { catchError, debounceTime, first, map, mapTo, switchMap } from 'rxjs/operators';
import { PasswordStrength, SignupService } from 'src/app/services/signup.service';

const { required, maxLength, pattern, email } = Validators;

@Component({
  selector: 'app-signup-form',
  templateUrl: './signup-form.component.html',
  styleUrls: ['./signup-form.component.css'],
})
export class SignupFormComponent {
  public passwordSubject = new Subject<string>();
  public passwordStrengthFromServer$ = this.passwordSubject.pipe(
    debounceTime(1000),
    switchMap((password) =>
      this.signupService.getPasswordStrength(password).pipe(catchError(() => EMPTY)),
    ),
  );
  public passwordStrength$ = merge(
    this.passwordSubject.pipe(mapTo(null)),
    this.passwordStrengthFromServer$,
  );

  public form = this.formBuilder.group({
    username: [
      null,
      [required, maxLength(50), pattern('[a-zA-Z0-9_]+')],
      (control: FormControl) => this.usernameValidator(control),
    ],
    email: [null, [required, email]],
    password: ['', required, () => this.passwordValidator()],
    address: this.formBuilder.group({
      name: [null, required],
      addressLine1: [null],
      addressLine2: [null, required],
      city: [null, required],
      postcode: [null, required],
      region: [null],
      country: [null, required],
    }),
  });

  public passwordStrength?: PasswordStrength;

  public submitProgress: 'idle' | 'success' | 'error' = 'idle';

  constructor(private signupService: SignupService, private formBuilder: FormBuilder) {}

  public usernameValidator(control: FormControl): Observable<ValidationErrors> {
    return timer(1000).pipe(
      switchMap(() => this.signupService.isUsernameTaken(control.value)),
      map((usernameTaken) => (usernameTaken ? { taken: true } : {})),
    );
  }

  public getPasswordStrength(): void {
    this.passwordSubject.next(this.form.controls.password.value);
  }

  public passwordValidator(): Observable<ValidationErrors> {
    return this.passwordStrength$.pipe(
      first((passwordStrength) => passwordStrength !== null),
      map((passwordStrength) =>
        passwordStrength && passwordStrength.score < 3 ? { weak: true } : {},
      ),
    );
  }

  public onSubmit(): void {
    this.signupService.signup(this.form.value).subscribe(
      () => {
        this.submitProgress = 'success';
      },
      () => {
        this.submitProgress = 'error';
      },
    );
  }
}

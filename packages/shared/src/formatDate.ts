export const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Ingen dato'; // Håndterer tomme datoer
    const dateParts = dateString.split('-'); // Deler opp datoen
    const date = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])); // Oppretter Date-objekt (måned er 0-indeksert)
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' }; // Format: måned, år
    return date.toLocaleDateString('no-NO', options); // Bruker norsk lokalitet
};